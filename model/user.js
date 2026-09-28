import YAML from 'yaml'
import miHoYoApi from "../model/mys/mihoyoApi.js"
import fs from 'node:fs'
import lodash from 'lodash'
import utils from '../model/mys/utils.js';
import gsCfg from './gsCfg.js';
import {
    isV3
} from '../components/Changelog.js';
import {
    Data
} from "../components/index.js";

const _path = process.cwd();
const plugin = "xiaoyao-cvs-plugin";
const yamlDataUrl = `${_path}/plugins/xiaoyao-cvs-plugin/data/yaml`;

/**
 * 米游社账号数据
 *
 * ⚠️ 与 genshin 插件的联动是这套功能的地基，别拆：
 * `getCookie()` 会从 genshin 的绑定库（`data/MysCookie/<QQ>.yaml`）取 ck 并**顺手把 uid 写进 e.uid**，
 * 抽卡记录的 authkey（`getAuthKey`）就靠这个 uid；扫码登录的最后一步也是调 genshin 的
 * `user.bing()` 把 ck 绑过去。去掉这一步会表现为「authkey 获取失败：登录状态失效」
 * （日志里 uid 是 undefined），而不是报缺函数。
 */
export default class user {
    constructor(e) {
        this.e = e;
        this.stokenPath = `./plugins/${plugin}/data/yaml/`
        this.ForumData = Data.readJSON(`${_path}/plugins/xiaoyao-cvs-plugin/defSet/json`, "mys")
        this.configSign = gsCfg.getfileYaml(`${_path}/plugins/xiaoyao-cvs-plugin/config/`, "config");
    }

    /**
     * 请求转发。
     * @param {boolean} isck 为 true 时先走一遍 cookie()，补全 e.uid / e.cookie（与 genshin 联动的那一步）
     */
    async getData(type, data = {}, isck = true) {
        if (isck) {
            await this.cookie(this.e)
        }
        this.miHoYoApi = new miHoYoApi(this.e);
        let res = await this.miHoYoApi.getData(type, data)
        return res
    }

    /**
     * 取该用户在 genshin 侧绑定的 ck，并把 uid 写进 e.uid
     * （扫码登录 / 抽卡记录都依赖它，见类头注释）
     *
     * ⚠️ 不能直接用 genshin 返回的 `skuid.item`：那是绑定库里 **isMain** 那条的 uid，
     * 而一个通行证下常挂多个角色（原神 / 星铁 / 绝区零），isMain 未必是用户在
     * 本插件里扫码绑过的那个。用错 uid 时 miHoYoApi 取不到 stoken（cookies 为空），
     * 表现就是「authkey 获取失败：登录状态失效」—— 但 ck 其实是好的。
     * 所以这里换成「同一通行证下、本插件 yaml 里确实有 stoken」的那个 uid。
     */
    async getCookie(e) {
        let skuid, cookie, uid
        if (isV3) {
            skuid = await gsCfg.getBingCookie(e.user_id);
            cookie = skuid?.ck;
            uid = skuid?.item;
            uid = this.pickUidWithStoken(e.user_id, skuid?.item, uid)
            if (!uid && e?.user?.getUid) {
                uid = e?.user?.getUid('gs')
                cookie = e?.user?.mysUser?.ck
            }
        }
        if (!uid) {
            uid = e.runtime?.user?._regUid
        }
        this.e.uid = uid;
        this.e.cookie = cookie;
        return {
            cookie,
            uid,
            skuid
        }
    }

    /**
     * 在「本插件已绑定的账号」里，挑一个可用于查抽卡记录的 uid
     *
     * 优先级（前一步失败才走下一步）：
     *  1. genshin 给的 uid 本身就有 stoken —— 最常见，直接返回
     *  2. 同一个通行证（ltuid）下、本插件 yaml 里存了 stoken 的角色
     *  3. yaml 里任意一个存了 stoken 的账号 —— 兜底
     *
     * 第 3 条是必须的：用户在 genshin 侧的主号可能根本没在本插件扫过码
     * （比如 #删除ck 之后又重新绑了别的号），只按通行证找会全部落空，
     * 又退回报「登录状态失效」—— 但手上明明有可用的凭证。
     *
     * @param {string} userId QQ
     * @param {string} ltuid 通行证 id（来自 genshin 绑定库）
     * @param {string} fallbackUid genshin 给的 isMain uid，都没得挑时原样返回
     * @returns {string} 可用的 uid，或 fallbackUid
     */
    pickUidWithStoken(userId, ltuid, fallbackUid = '') {
        let mine = {}
        try {
            mine = YAML.parse(fs.readFileSync(`${yamlDataUrl}/${userId}.yaml`, 'utf-8')) || {}
        } catch (err) {
            // 没绑过 / 文件损坏：保持原样，由调用方走后续降级
            return fallbackUid
        }
        const hasSk = (uid) => !!mine[String(uid)]?.stoken
        // ① genshin 给的 uid 就有 stoken
        if (fallbackUid && hasSk(fallbackUid)) return fallbackUid
        // ② 同一通行证下的其它角色
        if (ltuid) {
            for (let uid of Object.keys(mine)) {
                if (String(mine[uid]?.stuid || '') === String(ltuid) && hasSk(uid)) {
                    logger.debug(`[米游社] 通行证 ${ltuid} 改用本插件已绑定的 uid ${uid}（genshin isMain 是 ${fallbackUid}）`)
                    return uid
                }
            }
        }
        // ③ 任意一个有凭证的账号兜底
        for (let uid of Object.keys(mine)) {
            if (hasSk(uid)) {
                logger.debug(`[米游社] genshin 的 uid ${fallbackUid} 在本插件无凭证，改用已绑定的 ${uid}`)
                return uid
            }
        }
        return fallbackUid
    }

    /**
     * 没有 stoken 记录时，用 genshin 的 login_ticket 反查一次 stoken 并落盘
     * 返回值只表示"这一步没抛"，调用方（gclog / bindStoken）不依赖它
     */
    async cookie(e) {
        let {
            cookie,
            uid,
            skuid
        } = await this.getCookie(e);
        if (!cookie) {
            return false;
        }
        let stokens = this.getStoken(e.user_id)
        if (!stokens) {
            return true;
        }
        if (!cookie.includes("login_ticket") && (isV3 && !skuid?.login_ticket)) {
            return false;
        }
        let flot = await this.stoken(cookie, e)
        await utils.sleepAsync(1000); //延迟加载防止文件未生成
        if (!flot) {
            return false;
        }
        return true;
    }

    /** 用 login_ticket 换 stoken（仅在该用户还没有 stoken 记录时执行） */
    async stoken(cookie, e) {
        this.e = e;
        let datalist = this.getStoken(e.user_id) || {}
        if (Object.keys(datalist).length > 0) {
            return true;
        }
        const map = await utils.getCookieMap(cookie);
        let loginTicket = map?.get("login_ticket");
        const loginUid = map?.get("login_uid") ? map?.get("login_uid") : map?.get("ltuid");
        if (isV3) {
            loginTicket = gsCfg.getBingCookie(e.user_id).login_ticket
        }
        let mhyapi = new miHoYoApi(this.e);
        let res = await mhyapi.getData("bbsStoken", {
            loginUid,
            loginTicket
        })
        if (res?.data) {
            datalist[e.uid] = {
                stuid: map?.get("account_id"),
                stoken: res.data.list[0].token,
                ltoken: res.data.list[1].token,
                uid: e.uid,
                userId: e.user_id,
                is_sign: true
            }
            gsCfg.saveBingStoken(e.user_id, datalist)
        }
        return true;
    }

    /**
     * 读取该用户的 stoken 数据；老格式（uid 在顶层）会顺手迁移成 uid 分组格式
     */
    getStoken(userId) {
        let file = `${yamlDataUrl}/${userId}.yaml`
        try {
            let ck = fs.readFileSync(file, 'utf-8')
            ck = YAML.parse(ck)
            if (ck?.uid) {
                let datalist = {};
                ck.userId = this.e.user_id
                datalist[ck.uid] = ck;
                ck = datalist
                gsCfg.saveBingStoken(this.e.user_id, datalist)
            }
            return ck[this.e.uid] || {}
        } catch (error) {
            return {}
        }
    }

    /**
     * 拿 stoken 换 ck，并把这个账号下的所有 uid 落盘
     * @param {*} data bbsGetCookie 的返回
     */
    async seachUid(data) {
        let ltoken = '', v2Sk;
        if (data?.data) {
            let res;
            if (this.e.sk) {
                if (this.e.sk.get('stoken')?.includes('v2_')) {
                    res = await this.getData('getLtoken', { cookies: this.e.raw_message }, false)
                    ltoken = res?.data?.ltoken
                }
                this.e.cookie =
                    `ltoken=${this.e.sk?.get('ltoken') || ltoken};ltuid=${this.e.sk?.get('stuid')};cookie_token=${data.data.cookie_token}; account_id=${this.e.sk?.get('stuid')};`
            } else {
                this.e.cookie = this.e.original_msg //发送的为cookies
                this.cookies = `stuid=${this.e.stuid};stoken=${data?.data?.list?.[0]?.token};ltoken=${data?.data?.list?.[1]?.token}`
                res = await this.getData('getLtoken', { cookies: this.cookies }, false)
                v2Sk = await this.getData('getByStokenV2', { headers: { Cookie: this.cookies } }, false)
            }
            let list = []
            for (let item of ['崩坏星穹铁道', '原神']) {
                let result = await this.getData("userGameInfo", this.getDataList(item)[0], false)
                if (result?.retcode != 0) {
                    continue;
                }
                list.push(...result?.data?.list)
            }
            if (list.length == 0) {
                logger.error(`[扫码登录] qq:${this.e.user_id} 未查询到任何游戏角色`)
                await this.e.reply(`未查询到该账号下的游戏角色，绑定失败~`)
                return false;
            }
            let uids = []
            for (let s of list) {
                let datalist = {}
                let uid = s.game_uid
                uids.push(s.region_name + ':' + uid)
                datalist[uid] = {
                    stuid: this.e?.sk?.get('stuid') || this.e.stuid,
                    stoken: v2Sk?.data?.token?.token || this.e?.sk?.get('stoken') || data?.data?.list?.[0]?.token,
                    ltoken: this.e?.sk?.get('ltoken') || ltoken || data?.data?.list?.[1]?.token,
                    mid: this.e?.sk?.get('mid') || v2Sk?.data?.user_info?.mid,
                    uid: uid,
                    userId: this.e.user_id,
                    is_sign: true,
                    region_name: s.region_name,
                    region: s.region
                }
                await gsCfg.saveBingStoken(this.e.user_id, datalist)
            }
            let msg = `${uids.join('\n')}\n绑定成功~`;
            msg += '\n【#ck查询】查看已绑定的账号'
            msg += '\n【#我的stoken】查看登录凭证'
            msg += '\n【#删除stoken】删除绑定信息'
            msg += '\n【#更新抽卡记录】更新抽卡记录'
            this.e.reply(msg)
            return true;
        }
        return false;
    }

    getDataList(name) {
        let otherName = lodash.map(this.ForumData, 'otherName')
        for (let [index, item] of Object.entries(otherName)) {
            if (item.includes(name)) { //循环结束未找到的时候返回原数组
                return [this.ForumData[index]]
            }
        }
        return this.ForumData;
    }
}
