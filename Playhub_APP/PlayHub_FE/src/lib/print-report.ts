/** Print the displayed report, preserving its SVG graphs and current chart selection. */
export async function printReport(element: HTMLElement, title: string): Promise<void> {
  const preview = window.open("", "_blank", "width=1100,height=850");
  if (!preview) throw new Error("Allow pop-ups to open your PDF report, then try again.");
  const doc = preview.document;
  doc.title = title;
  doc.documentElement.lang = "en";
  const base = doc.createElement("base");
  base.href = document.baseURI;
  doc.head.append(base);
  const stylesReady: Promise<void>[] = [];
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    const copy = node.cloneNode(true) as HTMLElement;
    if (copy.tagName === "LINK")
      stylesReady.push(
        new Promise<void>((resolve) => {
          copy.addEventListener("load", () => resolve(), { once: true });
          copy.addEventListener("error", () => resolve(), { once: true });
          setTimeout(resolve, 10000);
        }),
      );
    doc.head.append(copy);
  });
  const css = doc.createElement("style");
  css.textContent = `
    @page { size: A4 portrait; margin: 12mm; }
    html, body { background: white !important; margin: 0; padding: 0; }
    body { padding: 24px; }
    main { max-width: 1100px; margin: auto; }
    *, *::before, *::after { animation: none !important; transition: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1, h2, h3, summary { break-after: avoid; }
    section, svg, li { break-inside: avoid; }
    [data-report-expand] { background: white; color: #072c61; border-radius: 12px; margin: 0 12px 12px; }
    [role="tooltip"] { display: none !important; }
    .report-instructions { margin: 0 0 20px; padding: 12px; background: #f2f4f7; font: 14px sans-serif; }
    @media print { body { padding: 0; } .report-instructions { display: none; } }
  `;
  doc.head.append(css);
  doc.body.className = document.body.className;
  const instructions = doc.createElement("div");
  instructions.className = "report-instructions";
  instructions.textContent = "Choose Save as PDF in the print dialog to download your report. ";
  const printButton = doc.createElement("button");
  printButton.textContent = "Save report as PDF";
  printButton.onclick = () => preview.print();
  instructions.append(printButton);
  const main = doc.createElement("main");
  const report = element.cloneNode(true) as HTMLElement;
  report.querySelectorAll("[data-report-exclude]").forEach((node) => node.remove());
  report.querySelectorAll("details").forEach((node) => {
    node.open = true;
  });
  report.querySelectorAll<HTMLElement>("[data-report-expand]").forEach((node) => {
    node.hidden = false;
  });
  // Controls become static labels; no application buttons are included in the exported report.
  report.querySelectorAll("button").forEach((button) => {
    if (/^(Share|Book|Export)\b/i.test(button.textContent?.trim() ?? "")) {
      button.remove();
      return;
    }
    const label = doc.createElement("span");
    label.className = button.className;
    label.innerHTML = button.innerHTML;
    button.replaceWith(label);
  });
  main.append(report);
  doc.body.replaceChildren(instructions, main);
  await Promise.all(stylesReady);
  await doc.fonts.ready;
  if (preview.closed) return;
  preview.focus();
  preview.print();
}
