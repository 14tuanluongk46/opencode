/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"
import { DEFAULT_THEMES } from "../../../src/theme"
import { ConfigProvider } from "../../../src/config"
import { ThemeProvider, type ThemeError, useTheme, useThemes } from "../../../src/context/theme"

async function wait(fn: () => boolean) {
  const started = Date.now()
  while (!fn()) {
    if (Date.now() - started > 2000) throw new Error("timed out waiting for theme mode")
    await Bun.sleep(10)
  }
}

test("uses an available mode while retaining the pinned preference", async () => {
  const lightOnly = structuredClone(DEFAULT_THEMES.opencode)
  lightOnly.theme.background = "#eeeeee"
  lightOnly.theme.text = "#111111"
  const dual = structuredClone(DEFAULT_THEMES.opencode)
  dual.theme.background = { light: "#eeeeee", dark: "#111111" }
  dual.theme.text = { light: "#111111", dark: "#eeeeee" }
  const darkOnly = structuredClone(DEFAULT_THEMES.opencode)
  darkOnly.theme.background = "#111111"
  darkOnly.theme.text = "#eeeeee"
  const native = { version: 2, dark: { text: { default: "#abcdef" } } } as const
  let themes: ReturnType<typeof useThemes> | undefined

  function Probe() {
    const value = useThemes()
    themes = value
    return <text>{value.mode()}</text>
  }

  function current() {
    if (!themes) throw new Error("Theme provider is not mounted")
    return themes
  }

  const app = await testRender(
    () => (
      <ConfigProvider config={createTuiResolvedConfig({ theme: { name: "light-only", mode: "dark" } })}>
        <ThemeProvider
          mode="dark"
          source={{ discover: () => Promise.resolve({ "light-only": lightOnly, "dark-only": darkOnly, dual, native }) }}
        >
          <Probe />
        </ThemeProvider>
      </ConfigProvider>
    ),
    { width: 20, height: 2 },
  )
  app.renderer.start()

  try {
    await wait(() => themes?.ready === true)
    expect(current().mode()).toBe("light")
    expect(current().modes()).toEqual(["light"])
    expect(current().supports("dark")).toBeFalse()
    expect(current().setMode("dark")).toBeFalse()
    expect(current().set("dark-only")).toBeTrue()
    await wait(() => current().mode() === "dark")
    expect(current().modes()).toEqual(["dark"])
    expect(current().set("light-only")).toBeTrue()
    await wait(() => current().mode() === "light")
    expect(current().set("dual")).toBeTrue()
    await wait(() => current().mode() === "dark")
    expect(current().modes()).toEqual(["light", "dark"])
    expect(current().set("native")).toBeTrue()
    await wait(() => current().selected === "native")
    expect(current().modes()).toEqual(["dark"])
    expect(current().current.text.default.equals(RGBA.fromHex("#abcdef"))).toBeTrue()
  } finally {
    app.renderer.destroy()
  }
})

test.each([
  ["schema", { version: 2, light: { categorical: [] } }],
  ["mode merging", { version: 2, light: { mergeMode: true } }],
  ["token reference", { version: 2, light: { text: { default: "$missing" } } }],
] as const)("falls back to OpenCode when configured V2 theme %s is invalid", async (_label, source) => {
  let themes: ReturnType<typeof useThemes> | undefined
  let failure: ThemeError | undefined
  let unsubscribe: (() => void) | undefined
  const discovery = Promise.withResolvers<Record<string, unknown>>()

  function Probe() {
    const value = useThemes()
    themes = value
    unsubscribe = value.onError((error) => (failure = error))
    return <text>{value.selected}</text>
  }

  const app = await testRender(
    () => (
      <ConfigProvider config={createTuiResolvedConfig({ theme: { name: "invalid" } })}>
        <ThemeProvider mode="dark" source={{ discover: () => discovery.promise }}>
          <Probe />
        </ThemeProvider>
      </ConfigProvider>
    ),
    { width: 20, height: 2 },
  )
  app.renderer.start()
  discovery.resolve({ invalid: source })

  try {
    await wait(() => themes?.ready === true)
    expect(themes?.selected).toBe("opencode")
    expect(failure?.name).toBe("invalid")
    expect(failure?.error).toBeInstanceOf(Error)
    expect(failure?.error.message.length).toBeGreaterThan(0)
  } finally {
    unsubscribe?.()
    app.renderer.destroy()
  }
})

test("surfaces are code-owned, absolute views of the base theme", async () => {
  let themes: ReturnType<typeof useThemes> | undefined
  let theme: ReturnType<typeof useTheme> | undefined

  function Probe() {
    themes = useThemes()
    theme = useTheme()
    return <text>{theme.text.default.toString()}</text>
  }

  const app = await testRender(
    () => (
      <ConfigProvider config={createTuiResolvedConfig({ theme: { name: "opencode", mode: "dark" } })}>
        <ThemeProvider mode="dark" source={{ discover: async () => ({}) }}>
          <Probe />
        </ThemeProvider>
      </ConfigProvider>
    ),
    { width: 20, height: 2 },
  )
  app.renderer.start()

  try {
    await wait(() => themes?.ready === true)
    if (!themes || !theme) throw new Error("Theme provider is not mounted")
    const raised = theme.surface("raised")
    expect(theme.surface("raised")).toBe(raised)
    expect(raised.surface("raised")).toBe(raised)
    expect(raised.background.default).toBe(themes.currentTokens().background.raised.base)
    expect(theme.surface("overlay").background.default).toBe(themes.currentTokens().background.raised.high)
    expect(raised.text.default).toBe(theme.text.default)
    expect(raised.raise(raised.background.raised.base)).toBe(themes.currentTokens().hue.neutral[600])
  } finally {
    app.renderer.destroy()
  }
})
