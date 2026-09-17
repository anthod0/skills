import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import Page from "../src/routes/+page.svelte";
import styles from "../src/app.css?raw";

function renderPage(draft: string | null = null) {
  return render(Page, {
    props: {
      data: {},
      params: {},
      form:
        draft === null
          ? null
          : {
              values: { message: "Where is my order?", context: "", tone: "friendly" },
              errors: {},
              error: null,
              draft,
            },
    },
  }).body;
}

describe("reply workspace", () => {
  it("offers a composer before there is a draft to copy", () => {
    const html = renderPage();
    expect(html).toMatch(/<form\b[^>]*method="POST"/i);
    expect(html).toMatch(/<textarea\b[^>]*name="message"[^>]*required/);
    expect(html).toMatch(/<button\b[^>]*type="button"[^>]*\sdisabled(?:\s|>)/);
    expect(styles).toContain("padding: 28px;");
    expect(styles).toContain("border-radius: 16px;");
  });

  it("shows a returned draft as text and makes it available to copy", () => {
    const html = renderPage("Hello <img src=x onerror=alert(1)> & thanks");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&amp; thanks");
    expect(html).not.toContain("<img");
    expect(html).toMatch(/<button\b[^>]*type="button"/);
    expect(html).not.toMatch(/<button\b[^>]*type="button"[^>]*\sdisabled(?:\s|>)/);
  });
});
