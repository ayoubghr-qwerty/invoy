export function printDocument(htmlContent) {
  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) {
    alert("Popup blocked — please allow popups for printing");
    return;
  }
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Impression</title>
      <style>
        @page { margin: 10mm; }
        body { margin: 0; padding: 0; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      ${htmlContent}
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); window.close(); }, 300);
        };
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
