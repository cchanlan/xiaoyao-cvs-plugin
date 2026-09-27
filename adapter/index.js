import plugin from '../../../lib/plugins/plugin.js'
import * as Apps from '../apps/index.js'
import { render } from './render.js'

export class atlas extends plugin {
  constructor (e) {
	let rule = {
	  reg: '.+',
	  fnc: 'dispatch'
	}
	let event=e?.event || e?.sub_type
    super({
      name: 'xiaoyao-cvs-plugin',
      desc: '米游社扫码登录',
      event: event === 'poke' ? 'notice.*.poke' : 'message',
      priority: 50,
      rule: [rule],
    })
	Object.defineProperty(rule, 'log', {
	  get: () => !!this.isDispatch
	})
  }
  accept () {
	this.e.original_msg = this.e.original_msg || this.e.msg
  }
  async dispatch (e) {
    let msg = e.original_msg || ''
    if (!msg) {
      return false
    }
    msg = msg.replace(/#|＃/, '#').trim()
    for (let fn in Apps.rule) {
      let cfg = Apps.rule[fn]
      if (Apps[fn] && new RegExp(cfg.reg).test(msg)) {
        let ret = await Apps[fn](e, {
          render
        })
        if (ret === true) {
          logger.mark(`${e.logFnc || '[xiaoyao-cvs-plugin(dispatch)]'} 命中 ${fn} (${cfg.reg})，已处理并终止后续插件`)
          return true
        }
      }
    }

    return false
  }
}
