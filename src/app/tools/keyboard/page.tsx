import { KeyboardTester } from "@/components/tools/keyboard-tester";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "keyboard",
  title: "Online Keyboard Tester",
  description:
    "Test every key on your keyboard with a visual tester. Supports QWERTY, AZERTY, Dvorak, and Colemak layouts. Choose 60%, 65%, 75%, TKL, or full-size keyboards. Auto-detect your layout.",
  keywords: [
    "keyboard tester",
    "keyboard test online",
    "key tester",
    "keyboard layout test",
    "qwerty test",
    "azerty test",
    "dvorak test",
    "colemak test",
    "mechanical keyboard test",
    "keyboard checker",
    "key press test",
  ],
});

export default function KeyboardPage() {
  const jsonLd = toolJsonLd("keyboard");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <style>{`body { overflow: hidden; }`}</style>
      <KeyboardTester />
    </>
  );
}
