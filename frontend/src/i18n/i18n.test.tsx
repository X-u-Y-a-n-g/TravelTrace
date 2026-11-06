import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { I18nProvider, useI18n } from "./index";

function Probe() {
  const { language, setLanguage, t, f } = useI18n();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="dashboard">{t("nav.dashboard")}</span>
      <span data-testid="date">{f.date("2026-10-01")}</span>
      <span data-testid="range">{f.dateRange("2026-10-01", "2026-10-08")}</span>
      <span data-testid="photo-one">{t("common.photoCount", { count: 1 })}</span>
      <span data-testid="photo-many">{t("common.photoCount", { count: 3 })}</span>
      <button type="button" onClick={() => setLanguage("en")}>
        switch
      </button>
    </div>
  );
}

describe("i18n", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
  });

  it("defaults to Chinese and formats dates locally", () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByTestId("language")).toHaveTextContent("zh");
    expect(screen.getByTestId("dashboard")).toHaveTextContent("仪表盘");
    expect(screen.getByTestId("date")).toHaveTextContent("2026年10月1日");
    expect(screen.getByTestId("range")).toHaveTextContent("2026年10月1日–8日");
    expect(screen.getByTestId("photo-one")).toHaveTextContent("1 张照片");
    expect(screen.getByTestId("photo-many")).toHaveTextContent("3 张照片");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(document.title).toContain("你的旅程");
  });

  it("switches to English, persists the choice and pluralises", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByTestId("language")).toHaveTextContent("en");
    expect(screen.getByTestId("dashboard")).toHaveTextContent("Dashboard");
    expect(screen.getByTestId("date")).toHaveTextContent("Oct 1, 2026");
    expect(screen.getByTestId("range")).toHaveTextContent("Oct 1–8, 2026");
    expect(screen.getByTestId("photo-one")).toHaveTextContent("1 photo");
    expect(screen.getByTestId("photo-many")).toHaveTextContent("3 photos");
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toContain("Your journey");
    expect(window.localStorage.getItem("traveltrace-language")).toBe("en");
  });
});
