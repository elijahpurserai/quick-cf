import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface PDFExportOptions {
    title: string;
    content: string;
    imageUrl?: string;
    metadata: string[];
    accentColor: string;
    gradientEnd: string;
    filename: string;
    dir?: "ltr" | "rtl";
}

const formatInline = (text: string): string =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>");

const markdownToHtml = (markdown: string, color: string): string => {
    const lines = markdown.split("\n");
    let html = "";
    let inUl = false;
    let inOl = false;

    const closeList = () => {
        if (inUl) { html += "</ul>"; inUl = false; }
        if (inOl) { html += "</ol>"; inOl = false; }
    };

    for (const line of lines) {
        if (/^#{1,3} /.test(line)) {
            closeList();
            const level = line.match(/^(#+) /)?.[1].length ?? 2;
            const text = line.replace(/^#+\s*/, "");
            const sizes: Record<number, string> = { 1: "24px", 2: "20px", 3: "18px" };
            html += `<h${level} style="font-size:${sizes[level] ?? "18px"};font-weight:700;color:${color};margin:24px 0 10px;border-bottom:2px solid ${color}33;padding-bottom:6px;font-family:Arial,Helvetica,sans-serif">${formatInline(text)}</h${level}>`;
        } else if (/^\d+\. /.test(line)) {
            if (inUl) { html += "</ul>"; inUl = false; }
            if (!inOl) { html += `<ol style="margin:12px 0;padding-left:28px">`; inOl = true; }
            html += `<li style="margin:5px 0;color:#374151;line-height:1.75">${formatInline(line.replace(/^\d+\.\s*/, ""))}</li>`;
        } else if (/^[-*] /.test(line)) {
            if (inOl) { html += "</ol>"; inOl = false; }
            if (!inUl) { html += `<ul style="margin:12px 0;padding-left:28px">`; inUl = true; }
            html += `<li style="margin:5px 0;color:#374151;line-height:1.75">${formatInline(line.replace(/^[-*]\s*/, ""))}</li>`;
        } else if (line.trim() === "") {
            closeList();
            html += `<div style="height:10px"></div>`;
        } else {
            closeList();
            html += `<p style="margin:0 0 14px;color:#374151;line-height:1.8;font-size:15px">${formatInline(line)}</p>`;
        }
    }
    closeList();
    return html;
};

const toDataURL = async (url: string): Promise<string | null> => {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
};

export const exportToPDF = async (options: PDFExportOptions): Promise<void> => {
    const { title, content, imageUrl, metadata, accentColor, gradientEnd, filename, dir = "ltr" } = options;

    const imageDataUrl = imageUrl ? await toDataURL(imageUrl) : null;

    const containerWidth = 794;
    const imageHeight = Math.round(containerWidth * 9 / 16);

    const imageHtml = imageDataUrl
        ? `<img src="${imageDataUrl}" style="width:${containerWidth}px;height:${imageHeight}px;object-fit:cover;display:block" />`
        : "";

    const metaHtml = metadata
        .map(m => `<span style="display:inline-block;background:#f3f4f6;border-radius:999px;padding:4px 12px;font-size:12px;color:#6b7280;margin:0 6px 6px 0">${m}</span>`)
        .join("");

    const contentHtml = markdownToHtml(content, accentColor);

    // Render inside a sandboxed iframe so Tailwind's oklch() CSS variables
    // are not in scope — html2canvas only sees plain inline styles.
    const srcdoc = `<!DOCTYPE html>
<html dir="${dir}">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: ${containerWidth}px; background: white; font-family: Arial, Helvetica, sans-serif; }
</style>
</head>
<body>
<div style="height:5px;background:linear-gradient(to right,${accentColor},${gradientEnd})"></div>
${imageHtml}
<div style="padding:40px 48px 48px">
  <h1 style="font-size:28px;font-weight:800;color:${accentColor};margin:0 0 16px;line-height:1.3;font-family:Arial,Helvetica,sans-serif">${title}</h1>
  <div style="margin-bottom:20px">${metaHtml}</div>
  <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0 24px">
  ${contentHtml}
</div>
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = `position:absolute;left:-${containerWidth + 100}px;top:0;border:none;width:${containerWidth}px;height:1px;overflow:hidden`;
    iframe.setAttribute("scrolling", "no");
    document.body.appendChild(iframe);

    await new Promise<void>((resolve, reject) => {
        iframe.onload = () => resolve();
        iframe.onerror = () => reject(new Error("iframe failed to load"));
        iframe.srcdoc = srcdoc;
    });

    // Resize iframe to full content height so html2canvas captures everything
    const iframeDoc = iframe.contentDocument!;
    const fullHeight = iframeDoc.documentElement.scrollHeight;
    iframe.style.height = `${fullHeight}px`;

    let canvas: HTMLCanvasElement;
    try {
        canvas = await html2canvas(iframeDoc.body, {
            scale: 2,
            useCORS: false,
            allowTaint: false,
            logging: false,
            backgroundColor: "#ffffff",
            width: containerWidth,
            height: fullHeight,
            windowWidth: containerWidth,
        });
    } finally {
        document.body.removeChild(iframe);
    }

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const doc = new jsPDF({ unit: "px", format: "a4", orientation: "portrait" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height / canvas.width) * pageWidth;
    let heightLeft = imgHeight;
    let position = 0;

    doc.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
        position -= pageHeight;
        doc.addPage();
        doc.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
    }

    doc.save(`${filename}.pdf`);
};
