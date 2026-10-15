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

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            flush_list()
            continue
            
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

    flush_list()

    # Also extract tables if present
    for table in doc.tables:
        table_html = ["<table class='doc-table'>"]
        for row in table.rows:
            table_html.append("<tr>")
            for cell in row.cells:
                cell_text = cell.text.strip().replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                table_html.append(f"<td>{cell_text}</td>")
            table_html.append("</tr>")
        table_html.append("</table>")
        html_parts.append("".join(table_html))

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

    # Extract tags or lines
    pattern = re.compile(r"<(li|p|h[1-6]|tr)[^>]*>(.*?)</\1>|([^\n<]+)", re.DOTALL | re.IGNORECASE)
    matches = pattern.finditer(content_text)

    has_content = False
    for m in matches:
        tag = (m.group(1) or "").lower()
        inner_html = m.group(2) if m.group(1) else m.group(3)
        if not inner_html:
            continue
        
        # Strip internal tags like <mark>, <span>, <strong>
        text = re.sub(r"<[^>]+>", "", inner_html).strip()
        if not text:
            continue
            
        has_content = True
        
        if tag == "li":
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.line_spacing = 1.2
            p.add_run(text)
        elif tag in ["h1", "h2", "h3"]:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run(text)
            run.bold = True
            run.font.size = Pt(14 if tag == "h1" else 13 if tag == "h2" else 12)
        else:
            p = doc.add_paragraph()
            p.paragraph_format.line_spacing = 1.3
            p.paragraph_format.space_after = Pt(8)
            
            # Check for heading pattern in raw text
            if re.match(r"^(\d+\.|\bAbstract\b|\bIntroduction\b|\bMethods\b|\bResults\b|\bDiscussion\b|\bConclusion\b|\bReferences\b)", text, re.I):
                run = p.add_run(text)
                run.bold = True
                run.font.size = Pt(13)
            else:
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
