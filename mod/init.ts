// import { moveSync, emptyDirSync, ensureDirSync, copySync, } from 'https://deno.land/std@0.100.0/fs/mod.ts'
import { tgz, } from 'https://deno.land/x/compress@v0.3.8/mod.ts'
import { parse, } from 'https://deno.land/std@0.100.0/flags/mod.ts'
import { cryptoRandomString, } from 'https://deno.land/x/crypto_random_string@1.0.0/mod.ts'
import { moveSync, } from 'https://deno.land/std@0.100.0/fs/mod.ts'
import { download, } from 'https://deno.land/x/download/mod.ts'
import 'https://deno.land/x/dotenv/load.ts'

const chmod = async (filePath: string) => {
  const p = Deno.run({
    cmd: ['chmod', '+x', filePath],
    stdout: 'piped',
  })
  await p.output()
}

const main = async () => {
  const APP_PATH = Deno.cwd() + '/'
  const command = Deno.args[1]

  const projectName = Deno.args[2] || 'xdevkit-sample-' + cryptoRandomString({ length: 4, type: 'alphanumeric', })
  const projectDirPath = './' + projectName
  const gzFileName = '__xdevkit_cli_targz_' + cryptoRandomString({ length: 10, type: 'alphanumeric', }) + '.tar.gz'
  const gzFilePath = '/tmp/' + gzFileName
  const tmpDirPath = '/tmp/__xdevkit_cli_uncompressed_' + cryptoRandomString({ length: 10, type: 'alphanumeric', }) + '/'

  /* curl https://xdevkit.com/x/xdevkit-sample.tar.gz --output /tmp/randomString.tar.gz */
  const url = 'https://xdevkit.com/x/xdevkit-sample.tar.gz'
  try {
    const fileObj = await download(url, {
      file: gzFileName,
      dir: '/tmp/',
    })
    console.log('[info] download done')
  } catch (err) {
    console.log(err)
  }

  /* tar xfz /tmp/__xdevkit_cli_targz_randomstring.tar.gz /tmp/__xdevkit_cli_uncompressed_randomstring2/ */
  await tgz.uncompress(gzFilePath, tmpDirPath)
  console.log('[info] uncompress done')

  /* mv /tmp/__xdevkit_cli_uncompressed_randomstring2/xdevkit-sample/ ./projectName */
  moveSync(tmpDirPath + 'xdevkit-sample/', projectDirPath)

  /* rm /tmp/__xdevkit_cli_targz_randomstring.tar.gz */
  await Deno.remove(gzFilePath)
  /* rm /tmp/__xdevkit_cli_uncompressed_randomstring2 */
  await Deno.remove(tmpDirPath, { recursive: true, })

  /* chmod +x ./projectName/xdevkit/command/*.sh */
  await chmod(APP_PATH + projectDirPath + '/xdevkit/command/run.sh')
  await chmod(APP_PATH + projectDirPath + '/xdevkit/command/compile.sh')
  await chmod(APP_PATH + projectDirPath + '/xdevkit/command/watch.sh')
  console.log('[info] init done')
}

export default main

