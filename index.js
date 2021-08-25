import { main, } from './src/index.js'


const index = () => {
  main()
}

if(import.meta.main) {
  index()
}

export default index

export const GDENO_OPTION_LIST = ['--allow-read', '--allow-write', '--allow-run', '--allow-env', '--allow-net', '--unstable']

