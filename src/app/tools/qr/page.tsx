import { QrGenerator } from "@/components/tools/qr-generator";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "qr",
  title: "QR Code Generator - URL, WiFi, vCard, Email, SMS",
  description:
    "Generate QR codes for URLs, WiFi credentials, vCard contacts, email, SMS, and phone numbers. Customize size, error correction, foreground and background colors. Download as PNG or SVG.",
  keywords: [
    "qr code generator",
    "qr code",
    "generate qr code",
    "qr code url",
    "wifi qr code",
    "vcard qr code",
    "qr code maker",
    "qr code download",
    "svg qr code",
    "free qr code",
    "custom qr code",
  ],
});

export default function QrPage() {
  const jsonLd = toolJsonLd("qr");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <QrGenerator />
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What is a QR code?</ToolInfo.H2>
          <ToolInfo.P>
            A QR code (Quick Response code) is a two-dimensional matrix barcode that encodes data as a grid of black and white squares. Developed in 1994, QR codes are now ubiquitous for encoding URLs, contact information, WiFi credentials, and other short strings that can be read by any smartphone camera.
          </ToolInfo.P>

          <ToolInfo.H2>How it works</ToolInfo.H2>
          <ToolInfo.P>
            Data is encoded into the QR matrix using Reed-Solomon error correction, which allows the code to remain scannable even when partially obscured or damaged. The <ToolInfo.Code>error correction level</ToolInfo.Code> controls the tradeoff between data capacity and damage tolerance — <ToolInfo.Code>L</ToolInfo.Code> stores more data, <ToolInfo.Code>H</ToolInfo.Code> tolerates up to 30% damage. Special content types like <ToolInfo.Code>WIFI:</ToolInfo.Code>, <ToolInfo.Code>mailto:</ToolInfo.Code>, and <ToolInfo.Code>BEGIN:VCARD</ToolInfo.Code> are recognized by phone cameras and trigger native actions.
          </ToolInfo.P>

          <ToolInfo.H2>How to use this tool</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Select an <ToolInfo.Strong>input type</ToolInfo.Strong> — Text/URL, WiFi, vCard, Email, SMS, or Phone</li>
            <li>Fill in the fields; the QR code <ToolInfo.Strong>updates in real time</ToolInfo.Strong></li>
            <li>Adjust <ToolInfo.Strong>size</ToolInfo.Strong> (128–1024px), <ToolInfo.Strong>error correction level</ToolInfo.Strong>, and <ToolInfo.Strong>colors</ToolInfo.Strong></li>
            <li><ToolInfo.Strong>Download as PNG</ToolInfo.Strong> for raster use or <ToolInfo.Strong>Download as SVG</ToolInfo.Strong> for print and vector workflows</li>
            <li><ToolInfo.Strong>Copy to clipboard</ToolInfo.Strong> to paste the image directly into documents or messaging apps</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common use cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Encoding a URL for print materials — the QR code opens the link when scanned</li>
            <li>Sharing WiFi credentials with guests without typing the password; uses the <ToolInfo.Code>WIFI:</ToolInfo.Code> format</li>
            <li>Business cards with a <ToolInfo.Code>vCard</ToolInfo.Code> QR code that saves contact info in one tap</li>
            <li>Pre-filled email drafts using the <ToolInfo.Code>mailto:</ToolInfo.Code> scheme with subject and body</li>
            <li>Linking to a phone number or SMS from a flyer or event poster</li>
          </ToolInfo.UL>
        </ToolInfo>
      </div>
    </>
  );
}
