#!/usr/bin/env python3
"""Build a print-friendly ICPC handbook from the site's Markdown archive."""

from __future__ import annotations

import html
import re
import shutil
from pathlib import Path

import yaml
from pygments import lex
from pygments.lexers import CppLexer, TextLexer, get_lexer_by_name
from pygments.styles import get_style_by_name
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Flowable,
    Frame,
    HRFlowable,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
TOPICS_DIR = ROOT / "src/content/problem-tags"
PROBLEMS_DIR = ROOT / "src/content/problems"
SOLUTIONS_DIR = ROOT / "solutions"
OUTPUT = ROOT / "output/pdf/icpc-contest-handbook.pdf"
PUBLIC_OUTPUT = ROOT / "public/downloads/icpc-contest-handbook.pdf"

PAGE_W, PAGE_H = A4
INK = colors.HexColor("#20231F")
MUTED = colors.HexColor("#6F756E")
GREEN = colors.HexColor("#526A58")
LIGHT_GREEN = colors.HexColor("#E8EEE9")
PAPER = colors.white
LINE = colors.HexColor("#D8DBD4")
CODE_BG = colors.HexColor("#F6F8FA")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("CN", "/home/lbh/.fonts/SimHei.ttf"))
    pdfmetrics.registerFont(
        TTFont("CNMono", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", subfontIndex=2)
    )


register_fonts()

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="BodyCN", fontName="CN", fontSize=10.2, leading=16.5,
    textColor=INK, wordWrap="CJK", spaceAfter=2.5 * mm,
))
styles.add(ParagraphStyle(
    name="LeadCN", parent=styles["BodyCN"], fontSize=11, leading=18,
    textColor=colors.HexColor("#485048"), spaceAfter=5 * mm,
))
styles.add(ParagraphStyle(
    name="Heading1CN", fontName="CN", fontSize=21, leading=27,
    textColor=INK, wordWrap="CJK", spaceBefore=2 * mm, spaceAfter=5 * mm,
))
styles.add(ParagraphStyle(
    name="Heading2CN", fontName="CN", fontSize=15.5, leading=21,
    textColor=GREEN, wordWrap="CJK", spaceBefore=4 * mm, spaceAfter=2.5 * mm,
))
styles.add(ParagraphStyle(
    name="Heading3CN", fontName="CN", fontSize=11.5, leading=17,
    textColor=INK, wordWrap="CJK", spaceBefore=3 * mm, spaceAfter=2 * mm,
))
styles.add(ParagraphStyle(
    name="MetaCN", fontName="CN", fontSize=8.3, leading=12,
    textColor=MUTED, wordWrap="CJK", spaceAfter=2.5 * mm,
))
styles.add(ParagraphStyle(
    name="BulletCN", parent=styles["BodyCN"], leftIndent=5 * mm,
    firstLineIndent=-3.4 * mm, bulletIndent=0, spaceAfter=1.3 * mm,
))
styles.add(ParagraphStyle(
    name="EquationCN", fontName="CNMono", fontSize=10, leading=15,
    alignment=TA_CENTER, textColor=INK, backColor=LIGHT_GREEN,
    borderPadding=(3 * mm, 4 * mm, 3 * mm, 4 * mm), spaceAfter=4 * mm,
))
styles.add(ParagraphStyle(
    name="CodeLine", fontName="CNMono", fontSize=7.15, leading=9.0,
    textColor=colors.HexColor("#24292F"), wordWrap=None, spaceAfter=0,
))
styles.add(ParagraphStyle(
    name="CodeNumber", fontName="CNMono", fontSize=6.4, leading=9.0,
    textColor=colors.HexColor("#9AA0A6"), alignment=TA_LEFT, spaceAfter=0,
))

PYGMENTS_STYLE = get_style_by_name("friendly")


def read_markdown(path: Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", raw, re.S)
    if not match:
        return {}, raw
    return yaml.safe_load(match.group(1)) or {}, match.group(2).strip()


def latex_to_text(value: str) -> str:
    def render_sum(match: re.Match[str]) -> str:
        scope = match.group(1).replace(r"\ne", "≠").replace(" ", "")
        return f"∑({scope})"

    value = re.sub(r"\\sum_\{([^}]+)\}", render_sum, value)
    value = re.sub(r"\\sum_([A-Za-z0-9])", render_sum, value)
    value = re.sub(r"_\{([^}]+)\}", r"_(\1)", value)
    value = re.sub(r"\^\{([^}]+)\}", r"^(\1)", value)
    replacements = {
        r"\textstyle": "", r"\le": "≤", r"\ge": "≥", r"\ne": "≠",
        r"\ldots": "…", r"\sum": "∑", r"\mid": "|", r"\ll": "<<",
        r"\to": "→", r"\frac": "frac", r"\left": "", r"\right": "",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    value = re.sub(r"\\begin\{[^}]+\}|\\end\{[^}]+\}", "", value)
    value = value.replace("\\", " ").replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", value).strip()


def inline_markup(value: str) -> str:
    value = latex_to_text(value.strip())
    parts = re.split(r"(`[^`]+`)", value)
    rendered = []
    for part in parts:
        if part.startswith("`") and part.endswith("`"):
            rendered.append(
                f'<font name="CNMono" color="#36513D">{html.escape(part[1:-1])}</font>'
            )
        else:
            part = html.escape(part)
            part = re.sub(r"_\(([^)]+)\)", r"<sub>\1</sub>", part)
            part = re.sub(r"_([A-Za-z0-9])", r"<sub>\1</sub>", part)
            part = re.sub(r"\^\(([^)]+)\)", r"<super>\1</super>", part)
            part = re.sub(r"\^([A-Za-z0-9])", r"<super>\1</super>", part)
            part = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", part)
            rendered.append(part.replace("$", ""))
    return "".join(rendered)


def highlighted_code(code: str, language: str = "cpp") -> Table:
    """Return a page-splittable, syntax-highlighted code table with line numbers."""
    try:
        lexer = get_lexer_by_name(language or "text")
    except Exception:
        lexer = CppLexer() if language in {"c", "cpp"} else TextLexer()

    lines: list[str] = []
    current: list[str] = []
    for token_type, value in lex(code.expandtabs(4), lexer):
        token_style = PYGMENTS_STYLE.style_for_token(token_type)
        color = f"#{token_style['color']}" if token_style.get("color") else "#24292F"
        for index, piece in enumerate(value.split("\n")):
            escaped = html.escape(piece).replace(" ", "&#160;")
            if escaped:
                escaped = f'<font color="{color}">{escaped}</font>'
                if token_style.get("bold"):
                    escaped = f"<b>{escaped}</b>"
                if token_style.get("italic"):
                    escaped = f"<i>{escaped}</i>"
                current.append(escaped)
            if index < len(value.split("\n")) - 1:
                lines.append("".join(current) or "&#160;")
                current = []
    if current or not lines:
        lines.append("".join(current) or "&#160;")

    data = [
        [Paragraph(str(number), styles["CodeNumber"]), Paragraph(line, styles["CodeLine"])]
        for number, line in enumerate(lines, 1)
    ]
    table = Table(
        data,
        colWidths=[8 * mm, PAGE_W - 34 * mm],
        splitByRow=1,
        hAlign="LEFT",
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("BOX", (0, 0), (-1, -1), 0.45, LINE),
        ("LINEAFTER", (0, 0), (0, -1), 0.35, colors.HexColor("#E1E4E8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (0, -1), 1.2 * mm),
        ("LEFTPADDING", (1, 0), (1, -1), 2.2 * mm),
        ("RIGHTPADDING", (1, 0), (1, -1), 2 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0.25 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.25 * mm),
    ]))
    return table


def markdown_flowables(body: str) -> list[Flowable]:
    result: list[Flowable] = []
    paragraph: list[str] = []
    code: list[str] = []
    equation: list[str] = []
    code_language = "cpp"
    in_code = False
    in_equation = False

    def flush_paragraph() -> None:
        if paragraph:
            result.append(Paragraph(inline_markup(" ".join(paragraph)), styles["BodyCN"]))
            paragraph.clear()

    for raw_line in body.splitlines() + [""]:
        line = raw_line.rstrip()
        if line.startswith("```"):
            if in_code:
                result.append(highlighted_code("\n".join(code), code_language))
                result.append(Spacer(1, 3 * mm))
                code.clear()
                in_code = False
            else:
                flush_paragraph()
                code_language = line[3:].strip() or "text"
                in_code = True
            continue
        if in_code:
            code.append(line.expandtabs(4))
            continue
        if line.strip() == "$$":
            if in_equation:
                result.append(Paragraph(inline_markup(" ".join(equation)), styles["EquationCN"]))
                equation.clear()
                in_equation = False
            else:
                flush_paragraph()
                in_equation = True
            continue
        if in_equation:
            equation.append(line)
            continue
        heading = re.match(r"^(#{2,3})\s+(.+)$", line)
        if heading:
            flush_paragraph()
            style = styles["Heading2CN"] if len(heading.group(1)) == 2 else styles["Heading3CN"]
            result.append(Paragraph(inline_markup(heading.group(2)), style))
            continue
        bullet = re.match(r"^[-*]\s+(.+)$", line)
        ordered = re.match(r"^(\d+)\.\s+(.+)$", line)
        if bullet or ordered:
            flush_paragraph()
            mark = "•" if bullet else f"{ordered.group(1)}."
            text = bullet.group(1) if bullet else ordered.group(2)
            result.append(Paragraph(f"{mark}　{inline_markup(text)}", styles["BulletCN"]))
            continue
        if not line.strip():
            flush_paragraph()
        else:
            paragraph.append(line.strip())
    return result


class HandbookDoc(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename, pagesize=A4,
            leftMargin=13 * mm, rightMargin=13 * mm,
            topMargin=13 * mm, bottomMargin=13 * mm,
            title="LBH ICPC 赛前速查册", author="LBH",
        )
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="main")
        self.addPageTemplates(PageTemplate(id="normal", frames=frame, onPage=self.draw_page))

    def draw_page(self, canvas, doc) -> None:
        canvas.saveState()
        canvas.setFillColor(PAPER)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        canvas.setFont("CNMono", 7)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(PAGE_W - 13 * mm, 7 * mm, str(doc.page))
        canvas.restoreState()

    def afterFlowable(self, flowable: Flowable) -> None:
        if isinstance(flowable, Paragraph):
            style = flowable.style.name
            if style in {"Heading1CN", "Heading2CN"}:
                level = 0 if style == "Heading1CN" else 1
                text = flowable.getPlainText()
                key = f"section-{self.seq.nextf('section')}"
                self.canv.bookmarkPage(key)
                self.canv.addOutlineEntry(text, key, level=level, closed=False)


def build_story() -> list[Flowable]:
    topic_entries = []
    for path in TOPICS_DIR.glob("*.md"):
        data, body = read_markdown(path)
        if not data.get("draft", False):
            topic_entries.append((data.get("order", 0), path, data, body))
    topic_entries.sort(key=lambda item: (item[0], item[2].get("title", "")))

    problem_entries = []
    for path in PROBLEMS_DIR.glob("*.md"):
        data, body = read_markdown(path)
        if not data.get("draft", False):
            problem_entries.append((str(data.get("solvedAt", "")), path, data, body))
    problem_entries.sort(key=lambda item: (item[0], item[1].name), reverse=True)

    story: list[Flowable] = [Paragraph("标签板子", styles["Heading1CN"])]
    for index, (_, path, data, body) in enumerate(topic_entries, 1):
        story.extend([
            HRFlowable(width="100%", thickness=0.5, color=LINE, spaceBefore=4 * mm, spaceAfter=4 * mm)
            if index > 1 else Spacer(1, 1 * mm),
            Paragraph(str(data.get("title", path.stem)), styles["Heading2CN"]),
            *markdown_flowables(body),
            Spacer(1, 2 * mm),
        ])

    story.extend([PageBreak(), Paragraph("做题记录", styles["Heading1CN"])])
    for index, (_, path, data, body) in enumerate(problem_entries, 1):
        title = str(data.get("title", path.stem))
        tags = " / ".join(str(tag) for tag in data.get("tags", []))
        source_url = html.escape(str(data.get("url", "")), quote=True)
        story.extend([
            CondPageBreak(58 * mm),
            HRFlowable(width="100%", thickness=0.6, color=LINE, spaceBefore=7 * mm, spaceAfter=7 * mm)
            if index > 1 else Spacer(1, 2 * mm),
            Paragraph(title, styles["Heading2CN"]),
            Paragraph(
                f"{inline_markup(str(data.get('platform', '')))}　"
                f"{inline_markup(str(data.get('solvedAt', '')))}　"
                f"{inline_markup(tags)}　"
                f'<link href="{source_url}" color="#526A58">原题</link>　'
                f"{inline_markup(str(data.get('code', '')))}",
                styles["MetaCN"],
            ),
            Paragraph("题目大意", styles["Heading3CN"]),
            *markdown_flowables(str(data.get("statement", ""))),
            Paragraph("思路", styles["Heading3CN"]),
            *markdown_flowables(body),
            Paragraph("代码", styles["Heading3CN"]),
        ])
        code_path = SOLUTIONS_DIR / str(data.get("code", ""))
        if code_path.exists():
            story.append(highlighted_code(
                code_path.read_text(encoding="utf-8").rstrip(),
                str(data.get("language", "cpp")),
            ))
        else:
            story.append(Paragraph("未找到对应代码文件。", styles["BodyCN"]))
    return story


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = HandbookDoc(str(OUTPUT))
    doc.build(build_story())
    shutil.copy2(OUTPUT, PUBLIC_OUTPUT)
    print(f"built {OUTPUT.relative_to(ROOT)}")
    print(f"copied {PUBLIC_OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
