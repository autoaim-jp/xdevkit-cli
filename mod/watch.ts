import { Language, minify } from 'https://deno.land/x/minifier/mod.ts'
import { moveSync, emptyDirSync, ensureDirSync, copySync, } from 'https://deno.land/std@0.100.0/fs/mod.ts'
import { renderFileToString, } from 'https://deno.land/x/dejs@0.9.3/mod.ts'
import { basename } from 'https://deno.land/std@0.100.0/path/mod.ts'
import { parse } from 'https://deno.land/std@0.100.0/flags/mod.ts'
import 'https://deno.land/x/dotenv/load.ts'

interface PathDateCache {
  [key: string]: number
}
interface EjsPageConfig {
  [key: string]: any,
}
interface EjsConfig {
  [key: string]: object
}

interface RegAction {
  regexp: RegExp,
  action: (path: string) => void,
}

const cacheForDuplicate: PathDateCache = {}
let ejsConfig: EjsConfig = {}
let JS_PATH_IN: string = ''
let CSS_PATH_IN: string = ''
let EJS_PATH_IN: string = ''
let BUILD_DIR: string = ''
let TAILWIND_CONFIG: string = ''
let TAILWIND_CSS_PATH: string = ''

let JS_PATH_OUT: string = ''
let CSS_PATH_OUT: string = ''
let EJS_PATH_OUT: string = ''

const buildAllJs = () => {
  for(const dirEntry of Deno.readDirSync(JS_PATH_IN)) {
    if(dirEntry.isDirectory) {
      buildPageJs(JS_PATH_IN + dirEntry.name + '/__dummy.js')
    } else if(dirEntry.isFile) {
      buildModJs(JS_PATH_IN + dirEntry.name)
    }
  }
}

const buildAllCss = () => {
  for(const dirEntry of Deno.readDirSync(CSS_PATH_IN)) {
    buildPageCss(CSS_PATH_IN + dirEntry.name)
  }
}

const buildAllEjs = () => {
  for(const dirEntry of Deno.readDirSync(EJS_PATH_IN)) {
    buildPageEjs(EJS_PATH_IN + dirEntry.name)
  }
}

const buildPageJs = (path: string) => {
  ensureDirSync(JS_PATH_OUT)
  const srcJsDirPath: string = path.replace(/^(.*)\/([^\/]*)\/[^\/]*\.js$/g, '$1/$2/')
  const buildJsDirPath: string = JS_PATH_OUT + path.replace(/^(.*)\/([^\/]*)\/[^\/]*\.js$/g, '$2')
  console.log('[info] new script dir path:', buildJsDirPath)
  setTimeout(() => {
    try {
      Deno.removeSync(buildJsDirPath, { recursive: true, })
    } catch(e) {
    }
    copySync(srcJsDirPath, buildJsDirPath)
  }, 300)
}

const buildModJs = (path: string) => {
  ensureDirSync(JS_PATH_OUT)
  const buildJsPath: string = JS_PATH_OUT + basename(path)
  console.log('[info] new script path:', buildJsPath)
  setTimeout(() => {
    copySync(path, buildJsPath, { overwrite: true, })
  }, 300)
}

const buildPageCss = async (path: string) => {
  ensureDirSync(CSS_PATH_OUT)
  const buildCssPath: string = CSS_PATH_OUT + basename(path)
  if(path.indexOf(TAILWIND_CSS_PATH) === (path.length - TAILWIND_CSS_PATH.length)) {
    console.log('[info] new tailwindcss path:', buildCssPath)
    const p = Deno.run({ 
      env: { NODE_ENV: 'dev', },
      cmd: ['tailwindcss', 'build', '-c', TAILWIND_CONFIG, '-i', path, '-o', buildCssPath],
      stdout: 'piped',
    })
    await p.output()
  } else {
    console.log('[info] new css path:', buildCssPath)
    setTimeout(() => {
      copySync(path, buildCssPath, { overwrite: true, })
    }, 300)
  }
}

const buildPageEjs = (path: string) => {
  console.log('[info] page ejs updated:', path)
  const ejsConfigKey: string = basename(path).replace(/\.ejs$/, '')
  const ejsPageConfig: EjsPageConfig = ejsConfig[ejsConfigKey]
  if(!ejsPageConfig) {
    throw new Error('[error] ejs config undefined: ' + ejsConfigKey)
    return
  }
  Object.assign(ejsPageConfig, ejsConfig._common)
  Object.assign(ejsPageConfig, { isProduction: false, })
  setTimeout(async () => {
    const htmlContent: string = await renderFileToString(path, ejsPageConfig)
    const buildHtmlPath: string = EJS_PATH_OUT + basename(path).replace(/\.ejs$/, '.html')
    Deno.writeTextFileSync(buildHtmlPath, htmlContent)
  }, 300)
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

const detectUpdateEjsConfig = (path: string) => {
  console.log('==================================================')
  console.log('[info] ejs file updated:', path)
  console.log('Please re run watch command.')
  console.log('==================================================')
}

const watch = async (path: string, regActionList: RegAction[]) => {
  const watcher = Deno.watchFs(path)
  for await (const event of watcher) {
    if(event.kind !== 'modify') {
      continue
    }
    for(const filePath of event.paths) {
      regActionList.forEach((row) => {
        if(row.regexp.test(filePath) && (!cacheForDuplicate[filePath] || cacheForDuplicate[filePath] < Date.now())) {
          console.log(path, row.regexp)
          cacheForDuplicate[filePath] = Date.now() + 2000
          row.action(filePath)
        }
      })
    }
  }
}

const main = async () => {
  const APP_PATH = Deno.cwd() + '/'
  const command = Deno.args[1]

  const argList = parse(Deno.args)
  JS_PATH_IN = argList.js || './custom/public/src/js/'
  CSS_PATH_IN = argList.css || './custom/public/src/css/'
  EJS_PATH_IN = argList.ejs || './custom/public/src/ejs/page/'
  BUILD_DIR = argList.out || './custom/public/build/'
  TAILWIND_CONFIG = argList.tailwindconfig || './custom/tailwind.config.js'
  TAILWIND_CSS_PATH = argList.tailwindcss || './custom/public/src/css/tailwind.css'
  const configFilePath = argList.ejsconfig || 'custom/ejs.config.ts'

  JS_PATH_OUT = BUILD_DIR + 'js/'
  CSS_PATH_OUT = BUILD_DIR + 'css/'
  EJS_PATH_OUT = BUILD_DIR
  ejsConfig = (await import(APP_PATH + configFilePath)).ejsConfig

  if(argList.once) {
    console.log('[info] build .js and build .ejs before watching!')
    removeBuildDir()
    buildAllJs()
    buildAllCss()
    buildAllEjs()
  } else {
    console.log('[info] To build/build file before watching, exec with --once option.')
  }
  watch(JS_PATH_IN, [
    { regexp: new RegExp(JS_PATH_IN + '.*/.*.js$'), action: buildPageJs, },
    { regexp: new RegExp(JS_PATH_IN + '.*.js$'), action: buildModJs, },
  ])
  watch(CSS_PATH_IN, [
    { regexp: /\.css$/, action: buildPageCss, },
  ])
  watch(EJS_PATH_IN, [
    { regexp: /\.ejs$/, action: buildPageEjs, },
  ])
  watch(configFilePath, [
    { regexp: /\.(js|ts)$/, action: detectUpdateEjsConfig, },
  ])
}

export default main

