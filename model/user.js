import YAML from 'yaml'
import miHoYoApi from "../model/mys/mihoyoApi.js"
import fs from 'node:fs'
import lodash from 'lodash'
import gsCfg from './gsCfg.js';
import {
    Data
} from "../components/index.js";

const _path = process.cwd();
const plugin = "xiaoyao-cvs-plugin";
const yamlDataUrl = `${_path}/plugins/xiaoyao-cvs-plugin/data/yaml`;

/**
 * 米游社账号数据
 * 只负责：请求转发（getData）、stoken 读写（getStoken/seachUid）
 */
export default class user {
    constructor(e) {
        this.e = e;
        this.stokenPath = `./plugins/${plugin}/data/yaml/`
        this.ForumData = Data.readJSON(`${_path}/plugins/xiaoyao-cvs-plugin/defSet/json`, "mys")
        this.configSign = gsCfg.getfileYaml(`${_path}/plugins/xiaoyao-cvs-plugin/config/`, "config");
    }

    async getData(type, data = {}) {
        this.miHoYoApi = new miHoYoApi(this.e);
        let res = await this.miHoYoApi.getData(type, data)
        return res
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
        if (!data?.data) return false;
        let ltoken = '', v2Sk;
        if (this.e.sk) {
            if (this.e.sk.get('stoken')?.includes('v2_')) {
                let res = await this.getData('getLtoken', { cookies: this.e.raw_message })
                ltoken = res?.data?.ltoken
            }
            this.e.cookie =
                `ltoken=${this.e.sk?.get('ltoken') || ltoken};ltuid=${this.e.sk?.get('stuid')};cookie_token=${data.data.cookie_token}; account_id=${this.e.sk?.get('stuid')};`
        } else {
            return false;
        }
        let list = []
        for (let item of ['崩坏星穹铁道', '原神']) {
            let result = await this.getData("userGameInfo", this.getDataList(item)[0])
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
                stuid: this.e?.sk?.get('stuid'),
                stoken: this.e?.sk?.get('stoken'),
                ltoken: this.e?.sk?.get('ltoken') || ltoken,
                mid: this.e?.sk?.get('mid'),
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
        this.e.reply(msg)
        return true;
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
