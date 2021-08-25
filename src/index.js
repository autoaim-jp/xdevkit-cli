const APP_PATH = new URL('../', import.meta.url).pathname

const MOD_DIR = APP_PATH + 'mod/'
const HELP_MESSAGE_LIST = [
  'xdevkit-cli help',
  '[info] usage: xdevkit-cli <command>',
  '<command>',
  '  init(projectName): download xldevkit as projectName dir',
  '  watch(--once): watch to bundle .js and build .ejs',
]

const showHelpMessage = () => {
  console.log(HELP_MESSAGE_LIST.join('\n'))
  const fileList = Deno.readDirSync(MOD_DIR)
  console.log('commandList:', [...fileList].map((row) => { return row.name.replace(/\.ts/g, '') }))
}

export const main = async () => {
  const currentDir = Deno.args[0]
  const command = Deno.args[1]
  if(!currentDir || !command) {
    showHelpMessage()
    return
  }
  try {
    const mod = await import(MOD_DIR + command + '.ts')
    mod.default(Deno.args)
  } catch(e) {
    console.log('[error] at module [', command, ']')
    console.log(e)
    showHelpMessage()
  }
}

if(import.meta.main) {
  main()
}

