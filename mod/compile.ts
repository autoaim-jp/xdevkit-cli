/**
 * yarn global add esbuild tailwindcss clean-css html-minifier js-beautify
 * sudo apt install uglifyjs
 */
import { Language, minify } from 'https://deno.land/x/minifier/mod.ts'
import { moveSync, emptyDirSync, ensureDirSync, copySync, } from 'https://deno.land/std@0.100.0/fs/mod.ts'
import { renderFileToString, } from 'https://deno.land/x/dejs@0.9.3/mod.ts'
import { parse } from 'https://deno.land/std@0.100.0/flags/mod.ts'
import { basename } from 'https://deno.land/std@0.100.0/path/mod.ts'
import 'https://deno.land/x/dotenv/load.ts'

export interface EjsPageConfig {
  [key: string]: any,
}

export interface EjsConfig {
  [key: string]: EjsPageConfig,                                                                                                                                                          
}

let ejsConfig: EjsConfig = {}
let JS_PATH_IN: string = ''
let CSS_PATH_IN: string = ''
let EJS_PATH_IN: string = ''
let BUILD_DIR: string = ''
let JS_PATH_OUT: string = ''
let CSS_PATH_OUT: string = ''
let EJS_PATH_OUT: string = ''
let TAILWIND_CONFIG: string = ''
let TAILWIND_CSS_PATH: string = ''
let MINIFY_HTML: boolean = false
const IGNORE_SRC_JS_DIR: string = '__xdevkit_common_copy'

const buildAllJs = async () => {
  const promiseList = []
  for(const dirEntry of Deno.readDirSync(JS_PATH_IN)) {
    if(dirEntry.isDirectory && IGNORE_SRC_JS_DIR !== dirEntry.name) {
      promiseList.push(buildPageJs(JS_PATH_IN + dirEntry.name + '/app.js'))
    }
  }
  await Promise.all(promiseList)
}

const buildAllEjsForTailwind = async () => {
  const promiseList = []
  for(const dirEntry of Deno.readDirSync(EJS_PATH_IN)) {
    promiseList.push(buildPageEjsForTailwind(EJS_PATH_IN + dirEntry.name))
  }
  await Promise.all(promiseList)
}

const buildAllCss = async () => {
  const promiseList = []
  for(const dirEntry of Deno.readDirSync(CSS_PATH_IN)) {
    promiseList.push(buildPageCss(CSS_PATH_IN + dirEntry.name))
  }
  await Promise.all(promiseList)
}

const buildAllEjs = async () => {
  const promiseList = []
  for(const dirEntry of Deno.readDirSync(EJS_PATH_IN)) {
    promiseList.push(buildPageEjs(EJS_PATH_IN + dirEntry.name))
  }
  await Promise.all(promiseList)
}


const buildPageJs = async (path: string) => {
  console.log('buildPageJs:', path)
  const appPath: string = path.replace(/^(.*)\/([^\/]*)\/[^\/]*\.js$/g, '$1\/$2\/app.js')
  const buildMinPath: string = JS_PATH_OUT + path.replace(/^(.*)\/([^\/]*)\/[^\/]*\.js$/g, '$2') + '/app.js'
  console.log('[info] page script updated:', path)
  console.log('[info] new build min script path:', buildMinPath)
  const p = Deno.run({ cmd: ['esbuild', appPath, '--outfile=' + buildMinPath, '--bundle'], stdout: 'piped', })
  await p.output()
  const p2 = Deno.run({ cmd: ['uglifyjs', '--compress', '--', buildMinPath], stdout: 'piped', })
  const jsMinified = new TextDecoder().decode(await p2.output())
  Deno.writeTextFileSync(buildMinPath, jsMinified)
}

const buildPageCss = async (path: string) => {
  ensureDirSync(CSS_PATH_OUT)
  const buildCssPath: string = CSS_PATH_OUT + basename(path)
  if(path.indexOf(TAILWIND_CSS_PATH) === (path.length - TAILWIND_CSS_PATH.length)) {
    console.log('[info] new tailwindcss path:', buildCssPath)
    const p = Deno.run({ 
      env: { NODE_ENV: 'production', },
      cmd: ['tailwindcss', 'build', '-c', TAILWIND_CONFIG, '-i', path, '-o', buildCssPath],
      stdout: 'piped',
    })
    await p.output()
  } else {
    console.log('[info] new css path:', buildCssPath)
    copySync(path, buildCssPath, { overwrite: true, })
  }

  const p2 = Deno.run({ 
    cmd: ['cleancss', buildCssPath],
    stdout: 'piped',
  })
  const cssMinified = new TextDecoder().decode(await p2.output())
  Deno.writeTextFileSync(buildCssPath, cssMinified)
}

const buildPageEjsForTailwind = async (path: string) => {
  console.log('[info] page ejs updated:', path)
  const ejsConfigKey: string = basename(path).replace(/\.ejs$/, '')
  const ejsPageConfig: EjsPageConfig = ejsConfig[ejsConfigKey]
  if(!ejsPageConfig) {
    throw new Error('[error] ejs config undefined: ' + ejsConfigKey)
    return
  }
  Object.assign(ejsPageConfig, ejsConfig._common)
  Object.assign(ejsPageConfig, { isProduction: false, })
  const htmlContent: string = await renderFileToString(path, ejsPageConfig)
  const buildHtmlPath: string = EJS_PATH_OUT + basename(path).replace(/\.ejs$/, '.html')
  Deno.writeTextFileSync(buildHtmlPath, htmlContent)
}

const buildPageEjs = async (path: string) => {
  console.log('[info] page ejs updated:', path)
  const ejsConfigKey: string = basename(path).replace(/\.ejs$/, '')
  const ejsPageConfig: EjsPageConfig = ejsConfig[ejsConfigKey]
  if(!ejsPageConfig) {
    throw new Error('[error] ejs config undefined: ' + ejsConfigKey)
    return
  }
  Object.assign(ejsPageConfig, ejsConfig._common)
  Object.assign(ejsPageConfig, { isProduction: true, })
  if(ejsPageConfig.inlineScriptList) {
    for(const [i, inlineJsPath] of Object.entries(ejsPageConfig.inlineScriptList)) {
      const scriptFilePath: string = EJS_PATH_OUT + inlineJsPath
      try {
        ejsPageConfig.inlineScriptList[i] = await Deno.readTextFileSync(scriptFilePath)
      } catch(e) {
        throw new Error('[error] script file not exists: ' + scriptFilePath)
      }
    }
  }
  if(ejsPageConfig.inlineCssList) {
    for(const [i, inlineCssPath] of Object.entries(ejsPageConfig.inlineCssList)) {
      const cssFilePath: string = EJS_PATH_OUT + inlineCssPath
      try {
        ejsPageConfig.inlineCssList[i] = await Deno.readTextFileSync(cssFilePath)
      } catch(e) {
        throw new Error('[error] css file not exists: ' + cssFilePath)
      }
    }
  }

  const htmlContent: string = await renderFileToString(path, ejsPageConfig)
  const buildHtmlPath: string = EJS_PATH_OUT + basename(path).replace(/\.ejs$/, '.html')
  Deno.writeTextFileSync(buildHtmlPath, htmlContent)

  if(MINIFY_HTML) {
    const p = Deno.run({
      cmd: ['html-minifier', '--collapse-whitespace', '--remove-comments', '--remove-optional-tags', '--remove-redundant-attributes', '--remove-script-type-attributes', '--remove-tag-whitespace', '--use-short-doctype', '--minify-css', 'true', '--minify-js', 'true', buildHtmlPath],
      stdout: 'piped',
    })
    const htmlMinified = new TextDecoder().decode(await p.output())
    Deno.writeTextFileSync(buildHtmlPath, htmlMinified)
  } else {
    const p = Deno.run({
      cmd: ['js-beautify', buildHtmlPath, '-r', '--preserve-new-lines', 'false', '--max-preserve-newlines', '0', '--wrap-line-length', '0', '--wrap-attributes-indent-size', '0', '--unformatted', 'style', '--unformatted', 'script', '--unformatted', 'pre'],
      stdout: 'piped',
    })
    await p.output()
  }
}

const removeBuildDir = () => {
  try {
    emptyDirSync(JS_PATH_OUT)
    console.log('[info] remove dir:', JS_PATH_OUT)
  } catch(e) {
    console.log('[info] dir is empty:', JS_PATH_OUT)
  }
  try {
    emptyDirSync(CSS_PATH_OUT)
    console.log('[info] remove dir:', CSS_PATH_OUT)
  } catch(e) {
    console.log('[info] dir is empty:', CSS_PATH_OUT)
  }
  try {
    emptyDirSync(EJS_PATH_OUT)
    console.log('[info] remove dir:', EJS_PATH_OUT)
  } catch(e) {
    console.log('[info] dir is empty:', EJS_PATH_OUT)
  }
}

const main = async () => {
  const APP_PATH = Deno.args[0]
  const command = Deno.args[1]

  const argList = parse(Deno.args)
  JS_PATH_IN = argList.js || './custom/public/src/js/'
  CSS_PATH_IN = argList.css || './custom/public/src/css/'
  EJS_PATH_IN = argList.ejs || './custom/public/src/ejs/page/'
  BUILD_DIR = argList.out || './custom/public/build/'
  TAILWIND_CONFIG = argList.tailwindconfig || './custom/tailwind.config.js'
  TAILWIND_CSS_PATH = argList.tailwindcss || './custom/public/src/css/tailwind.css'
  MINIFY_HTML = !!argList.minify
  const configFilePath = argList.ejsconfig || 'custom/ejs.config.ts'

  JS_PATH_OUT = BUILD_DIR + 'js/'
  CSS_PATH_OUT = BUILD_DIR + 'css/'
  EJS_PATH_OUT = BUILD_DIR
  ejsConfig = (await import(APP_PATH + configFilePath)).ejsConfig

  removeBuildDir()
  await buildAllJs()
  await buildAllEjsForTailwind()
  await buildAllCss()
  await buildAllEjs()
}

export default main

