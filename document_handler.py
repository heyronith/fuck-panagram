import io
import re
from typing import Dict, Any, List

try:
    import docx
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
except ImportError:
    docx = None

try:
    import pypdf
except ImportError:
    pypdf = None

def parse_docx(file_bytes: bytes) -> Dict[str, Any]:
    if docx is None:
        return {
            "success": False,
            "error": "Word document processor (python-docx) is not installed on this server environment."
        }
    
    from docx.text.paragraph import Paragraph
    from docx.table import Table

    doc = docx.Document(io.BytesIO(file_bytes))
    html_parts = []
    text_parts = []
    current_list_type = None # 'ul' or 'ol' or None
    current_list_items = []

    def flush_list():
        nonlocal current_list_type, current_list_items
        if current_list_items and current_list_type:
            tag = current_list_type
            cls = "doc-list" if tag == "ul" else "doc-list doc-list-ordered"
            items_html = "".join(f"<li class='doc-list-item'>{item}</li>" for item in current_list_items)
            html_parts.append(f"<{tag} class='{cls}'>{items_html}</{tag}>")
            current_list_items = []
            current_list_type = None

    def process_paragraph(para: Paragraph):
        nonlocal current_list_type, current_list_items
        text = para.text.strip()
        if not text:
            flush_list()
            return
            
        text_parts.append(text)
        style_name = para.style.name.lower() if para.style else ""
        escaped = (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

        # Check for Word XML numbering or bullet styles
        has_num_pr = False
        try:
            has_num_pr = len(para._p.xpath('./w:pPr/w:numPr')) > 0
        except Exception:
            has_num_pr = False

        is_bullet_style = any(s in style_name for s in ["bullet", "list bullet"])
        is_number_style = any(s in style_name for s in ["list number", "numbering"]) or has_num_pr
        
        # Check text prefix for bullet symbols
        bullet_match = re.match(r"^[\u2022\u25cf\u25cb\u25a0\u2013\u2014\-\*]\s+(.*)", text)
        number_match = re.match(r"^(\d+\.|\([0-9a-zA-Z]+\)|[a-zA-Z]\.)\s+(.*)", text)

        # Check for Figure or Table caption
        caption_match = re.match(r"^(Figure|Fig\.|Table|Scheme)\s+(\d+|[A-Z0-9\.\-]+)[\:\.\-]\s*(.*)", text, re.IGNORECASE)

        if is_bullet_style or bullet_match:
            clean_item = bullet_match.group(1) if bullet_match else text
            clean_escaped = clean_item.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            if current_list_type != "ul":
                flush_list()
                current_list_type = "ul"
            current_list_items.append(clean_escaped)

        elif is_number_style or number_match:
            clean_item = number_match.group(2) if number_match else text
            clean_escaped = clean_item.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            if current_list_type != "ol":
                flush_list()
                current_list_type = "ol"
            current_list_items.append(clean_escaped)

        elif caption_match:
            flush_list()
            prefix = f"{caption_match.group(1)} {caption_match.group(2)}:"
            cap_body = caption_match.group(3).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            is_table_caption = caption_match.group(1).lower().startswith("table")
            cls = "doc-caption doc-table-caption" if is_table_caption else "doc-caption doc-figure-caption"
            html_parts.append(f"<p class='{cls}'><strong class='caption-label'>{prefix}</strong> {cap_body}</p>")

        else:
            flush_list()
            if "heading 1" in style_name or "title" in style_name:
                html_parts.append(f"<h1 class='doc-heading-1'>{escaped}</h1>")
            elif "heading 2" in style_name:
                html_parts.append(f"<h2 class='doc-heading-2'>{escaped}</h2>")
            elif "heading 3" in style_name:
                html_parts.append(f"<h3 class='doc-heading-3'>{escaped}</h3>")
            else:
                html_parts.append(f"<p class='doc-paragraph'>{escaped}</p>")

    def process_table(table: Table):
        flush_list()
        if not table.rows:
            return

        table_rows_text = []
        table_html = ["<div class='doc-table-wrap'><table class='doc-table'>"]
        
        # Determine if first row is header
        has_header = False
        try:
            has_header = any("tblHeader" in r._tr.xml for r in table.rows) or len(table.rows) > 1
        except Exception:
            has_header = len(table.rows) > 1

        for r_idx, row in enumerate(table.rows):
            cell_texts = []
            is_header_row = (r_idx == 0 and has_header)
            row_tag = "th" if is_header_row else "td"
            cell_cls = "doc-table-header" if is_header_row else "doc-table-cell"

            if r_idx == 0 and has_header:
                table_html.append("<thead><tr class='doc-table-row'>")
            elif r_idx == 1 and has_header:
                table_html.append("<tbody><tr class='doc-table-row'>")
            else:
                table_html.append("<tr class='doc-table-row'>")

            for cell in row.cells:
                clean_text = cell.text.strip()
                cell_texts.append(clean_text)
                cell_escaped = clean_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                table_html.append(f"<{row_tag} class='{cell_cls}'>{cell_escaped}</{row_tag}>")

            table_html.append("</tr>")
            if r_idx == 0 and has_header:
                table_html.append("</thead>")

            if cell_texts:
                table_rows_text.append(" | ".join(cell_texts))

        if has_header and len(table.rows) > 1:
            table_html.append("</tbody>")

        table_html.append("</table></div>")
        html_parts.append("".join(table_html))
        if table_rows_text:
            text_parts.append("\n".join(table_rows_text))

    # Iterate through body elements in true document order
    try:
        for child in doc.element.body:
            if child.tag.endswith('p'):
                process_paragraph(Paragraph(child, doc))
            elif child.tag.endswith('tbl'):
                process_table(Table(child, doc))
    except Exception:
        # Fallback to separate iteration if body traversal encounters unrecognized XML
        for para in doc.paragraphs:
            process_paragraph(para)
        for tbl in doc.tables:
            process_table(tbl)

    flush_list()

    return {
        "success": True,
        "html": "\n".join(html_parts) if html_parts else "<p class='doc-paragraph'>Document is empty.</p>",
        "text": "\n\n".join(text_parts)
    }

def parse_pdf(file_bytes: bytes) -> Dict[str, Any]:
    if pypdf is None:
        return {
            "success": False,
            "error": "PDF processor (pypdf) is not installed on this server environment."
        }
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    html_parts = []
    text_parts = []
    current_list_type = None
    current_list_items = []

    def flush_list():
        nonlocal current_list_type, current_list_items
        if current_list_items and current_list_type:
            tag = current_list_type
            cls = "doc-list" if tag == "ul" else "doc-list doc-list-ordered"
            items_html = "".join(f"<li class='doc-list-item'>{item}</li>" for item in current_list_items)
            html_parts.append(f"<{tag} class='{cls}'>{items_html}</{tag}>")
            current_list_items = []
            current_list_type = None

    for page_num, page in enumerate(reader.pages):
        page_text = page.extract_text() or ""
        paras = [p.strip() for p in page_text.split("\n\n") if p.strip()]
        if not paras:
            paras = [p.strip() for p in page_text.split("\n") if p.strip()]

        for p in paras:
            text = " ".join(p.split())
            if not text:
                flush_list()
                continue
            text_parts.append(text)
            escaped = (
                text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            )

            bullet_match = re.match(r"^[\u2022\u25cf\u25cb\u25a0\u2013\u2014\-\*]\s+(.*)", text)
            number_match = re.match(r"^(\d+\.|\([0-9a-zA-Z]+\)|[a-zA-Z]\.)\s+(.*)", text)

            if bullet_match:
                clean_item = bullet_match.group(1).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                if current_list_type != "ul":
                    flush_list()
                    current_list_type = "ul"
                current_list_items.append(clean_item)
            elif number_match:
                clean_item = number_match.group(2).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                if current_list_type != "ol":
                    flush_list()
                    current_list_type = "ol"
                current_list_items.append(clean_item)
            else:
                flush_list()
                if len(text) < 60 and (re.match(r"^(\d+\.|\bAbstract\b|\bIntroduction\b|\bMethods\b|\bResults\b|\bDiscussion\b|\bReferences\b)", text, re.I) or text.isupper()):
                    html_parts.append(f"<h2 class='doc-heading-2'>{escaped}</h2>")
                else:
                    html_parts.append(f"<p class='doc-paragraph'>{escaped}</p>")

    flush_list()

    return {
        "success": True,
        "html": "\n".join(html_parts) if html_parts else "<p class='doc-paragraph'>No text could be extracted from PDF.</p>",
        "text": "\n\n".join(text_parts)
    }

def parse_text(file_bytes: bytes) -> Dict[str, Any]:
    try:
        content = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = file_bytes.decode("latin-1", errors="ignore")

    lines = content.split("\n")
    html_parts = []
    current_list_type = None
    current_list_items = []

    def flush_list():
        nonlocal current_list_type, current_list_items
        if current_list_items and current_list_type:
            tag = current_list_type
            cls = "doc-list" if tag == "ul" else "doc-list doc-list-ordered"
            items_html = "".join(f"<li class='doc-list-item'>{item}</li>" for item in current_list_items)
            html_parts.append(f"<{tag} class='{cls}'>{items_html}</{tag}>")
            current_list_items = []
            current_list_type = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            flush_list()
            continue
            
        escaped = stripped.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        
        bullet_match = re.match(r"^[\-\*\+]\s+(.*)", stripped)
        number_match = re.match(r"^(\d+\.|\([0-9a-zA-Z]+\))\s+(.*)", stripped)

        if bullet_match:
            clean_item = bullet_match.group(1).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            if current_list_type != "ul":
                flush_list()
                current_list_type = "ul"
            current_list_items.append(clean_item)
        elif number_match:
            clean_item = number_match.group(2).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            if current_list_type != "ol":
                flush_list()
                current_list_type = "ol"
            current_list_items.append(clean_item)
        else:
            flush_list()
            if stripped.startswith("# "):
                html_parts.append(f"<h1 class='doc-heading-1'>{escaped[2:]}</h1>")
            elif stripped.startswith("## "):
                html_parts.append(f"<h2 class='doc-heading-2'>{escaped[3:]}</h2>")
            elif stripped.startswith("### "):
                html_parts.append(f"<h3 class='doc-heading-3'>{escaped[4:]}</h3>")
            else:
                html_parts.append(f"<p class='doc-paragraph'>{escaped}</p>")

    flush_list()

    return {
        "success": True,
        "html": "\n".join(html_parts) if html_parts else "<p class='doc-paragraph'>Empty file.</p>",
        "text": content
    }

def generate_docx_from_html_or_text(content_text: str, title: str = "Manuscript") -> io.BytesIO:
    """
    Creates a professionally formatted academic Word (.docx) document,
    preserving headings, paragraphs, bullet points, and numbered lists.
    """
    if docx is None:
        buffer = io.BytesIO()
        clean = re.sub(r'<[^>]+>', '', content_text)
        buffer.write(clean.encode('utf-8'))
        buffer.seek(0)
        return buffer

    doc = docx.Document()

    # Set 1-inch standard academic margins
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(1)
        s.bottom_margin = Inches(1)
        s.left_margin = Inches(1)
        s.right_margin = Inches(1)

    # Set Default Font to Times New Roman, 12pt
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(12)
    font.color.rgb = RGBColor(15, 23, 42)

    # Tokenize content by top-level blocks: tables vs paragraphs/headings/lists
    # First, split or iterate through blocks
    block_pattern = re.compile(
        r"(<table[\s\S]*?</table>)|"
        r"(<(?:li|p|h[1-6]|figcaption)[^>]*>[\s\S]*?</(?:li|p|h[1-6]|figcaption)>)|"
        r"([^\n<]+)",
        re.IGNORECASE
    )

    matches = block_pattern.finditer(content_text)
    has_content = False

    for m in matches:
        table_html = m.group(1)
        tag_html = m.group(2)
        plain_text = m.group(3)

        if table_html:
            has_content = True
            # Extract rows from table
            row_pattern = re.compile(r"<tr[^>]*>([\s\S]*?)</tr>", re.IGNORECASE)
            cell_pattern = re.compile(r"<(th|td)[^>]*>([\s\S]*?)</\1>", re.IGNORECASE)
            
            rows_data = []
            max_cols = 0
            for r_match in row_pattern.finditer(table_html):
                row_cells = []
                is_header = False
                for c_match in cell_pattern.finditer(r_match.group(1)):
                    cell_tag = c_match.group(1).lower()
                    if cell_tag == "th":
                        is_header = True
                    raw_cell = re.sub(r"<[^>]+>", "", c_match.group(2)).strip()
                    row_cells.append(raw_cell)
                if row_cells:
                    max_cols = max(max_cols, len(row_cells))
                    rows_data.append({"cells": row_cells, "is_header": is_header})

            if rows_data and max_cols > 0:
                table = doc.add_table(rows=len(rows_data), cols=max_cols)
                try:
                    table.style = 'Table Grid'
                except Exception:
                    pass

                for r_idx, r_info in enumerate(rows_data):
                    cells = r_info["cells"]
                    is_head = r_info["is_header"] or (r_idx == 0 and len(rows_data) > 1)
                    for c_idx in range(max_cols):
                        val = cells[c_idx] if c_idx < len(cells) else ""
                        c = table.cell(r_idx, c_idx)
                        c.text = val
                        if is_head:
                            for cp in c.paragraphs:
                                for crun in cp.runs:
                                    crun.bold = True
                
                # Add spacing after table
                spacer = doc.add_paragraph()
                spacer.paragraph_format.space_before = Pt(4)
                spacer.paragraph_format.space_after = Pt(4)

        elif tag_html:
            # Determine tag
            tag_match = re.match(r"^<([a-zA-Z0-9]+)", tag_html)
            tag = tag_match.group(1).lower() if tag_match else "p"
            raw_text = re.sub(r"<[^>]+>", "", tag_html).strip()
            if not raw_text:
                continue

            has_content = True
            is_caption = ("doc-caption" in tag_html) or tag == "figcaption" or re.match(r"^(Figure|Fig\.|Table|Scheme)\s+\d+", raw_text, re.I)

            if tag == "li":
                p = doc.add_paragraph(style='List Bullet')
                p.paragraph_format.space_after = Pt(4)
                p.paragraph_format.line_spacing = 1.2
                p.add_run(raw_text)
            elif tag in ["h1", "h2", "h3"]:
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(12)
                p.paragraph_format.space_after = Pt(6)
                run = p.add_run(raw_text)
                run.bold = True
                run.font.size = Pt(14 if tag == "h1" else 13 if tag == "h2" else 12)
            elif is_caption:
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(4)
                p.paragraph_format.space_after = Pt(8)
                run = p.add_run(raw_text)
                run.font.size = Pt(10)
                run.italic = True
                run.font.color.rgb = RGBColor(71, 85, 105)
            else:
                p = doc.add_paragraph()
                p.paragraph_format.line_spacing = 1.3
                p.paragraph_format.space_after = Pt(8)
                if re.match(r"^(\d+\.|\bAbstract\b|\bIntroduction\b|\bMethods\b|\bResults\b|\bDiscussion\b|\bConclusion\b|\bReferences\b)", raw_text, re.I):
                    run = p.add_run(raw_text)
                    run.bold = True
                    run.font.size = Pt(13)
                else:
                    p.add_run(raw_text)

        elif plain_text:
            text = plain_text.strip()
            if not text:
                continue
            has_content = True
            p = doc.add_paragraph()
            p.paragraph_format.line_spacing = 1.3
            p.paragraph_format.space_after = Pt(8)
            p.add_run(text)

    if not has_content:
        # Fallback if content was raw plain text
        for line in content_text.split("\n"):
            line = line.strip()
            if not line:
                continue
            if line.startswith(("- ", "* ", "• ")):
                p = doc.add_paragraph(style='List Bullet')
                p.add_run(line[2:].strip())
            else:
                p = doc.add_paragraph()
                p.add_run(line)

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer
