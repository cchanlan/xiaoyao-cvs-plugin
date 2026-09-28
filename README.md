# xiaoyao-cvs-plugin

米游社扫码登录插件，扫码即可把米游社 stoken / cookie 绑定到云崽。

项目仅供学习交流使用，严禁用于任何商业用途和非法行为。

## 功能

- 扫码登录，自动获取 stoken 与 cookie
- 查看已绑定的账号列表
- 查看 / 删除已绑定的账号
- 更新原神抽卡记录（与 genshin 插件联动）

图鉴、体力、签到、充值等功能已移除。

## 安装

到 Yunzai 根目录下执行：

```
git clone https://github.com/cchanlan/xiaoyao-cvs-plugin.git ./plugins/xiaoyao-cvs-plugin/
```

> 目录名必须是 `xiaoyao-cvs-plugin`，其它插件（genshin、xhh-TL 等）按这个路径读取账号数据。

## 使用

配合云崽使用：https://gitee.com/Le-niao/Yunzai-Bot

配合喵崽使用：https://gitee.com/yoimiya-kokomi/Miao-Yunzai.git

配合 TRSS 崽使用：https://gitee.com/TimeRainStarSky/Yunzai

配合 JiuLi 使用：https://gitee.com/HL-z7/JiuLi

### 指令

| 指令 | 别名 | 说明 |
| --- | --- | --- |
| `#扫码登录` | `#二维码登录`、`#辅助登录` | 扫码绑定米游社账号 |
| `#ck查询` | `#stoken查询`、`#cookie查询`、`#账号查询` | 查看已绑定的账号列表 |
| `#我的stoken` | `#我的sk` | 查看已绑定账号的登录凭证 |
| `#删除stoken` | `#删除sk` | 删除已绑定的账号，可跟 uid 指定 |
| `#刷新ck` | `#获取ck`、`#更新ck`、`#获取cookie` | 用已绑定的 stoken 重新换出 ck |
| `#更新抽卡记录` | `#获取抽卡记录`、`#导出抽卡记录` | 更新原神抽卡记录 |
| `#米游社帮助` | `#mys帮助`、`#扫码帮助` | 查看帮助 |
| `#米游社版本` | `#mys版本`、`#扫码版本` | 查看更新日志 |

手动绑定：私聊直接发送 `stuid=...;stoken=...;ltoken=...;` 形式的串即可绑定，
不用扫码。发送含 `login_ticket` 的 ck 串时，可在锅巴打开 `ck.sk` 自动换出 stoken。

### 扫码登录怎么用

1. 发送 `#扫码登录`
2. 用米游社 App 扫描机器人发出的二维码
3. 在手机上确认登录
4. 绑定成功后机器人会回复账号列表

> 默认群聊私聊都可用，可在锅巴或 `config/config.yaml` 里改 `mhy.qrcode`：
> `0` 都可用 / `1` 仅群聊可用 / `2` 仅私聊可用 / `3` 关闭扫码登录。

### 抽卡记录怎么用

需要先扫码绑定账号（账号的 ck 由 genshin 插件保管）。

- `#更新抽卡记录` 拉取最新的抽卡记录
- `#获取抽卡记录`、`#导出抽卡记录` 导出抽卡链接，可复制到其它 bot 或工具使用（需私聊）

> 抽卡记录依赖 genshin 插件，请确保已安装并正常加载。

### 删除账号

- 发送 `#删除stoken` 删除本插件里绑定的账号，可跟 uid 指定
- 云崽的 `#删除ck` 也会连带删除本插件里对应的米游社凭证
  （同一个通行证下的所有角色会一起删掉）

### 凭证失效了怎么办

`#更新抽卡记录` 或 `#刷新ck` 提示登录失效时，机器人会自动清理掉失效的凭证，
发送 `#扫码登录` 重新绑定即可，不用手动删。

## 配置

配置文件位于 `./plugins/xiaoyao-cvs-plugin/config/config.yaml`，默认值在 `defSet/config/config.yaml`。

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `mhy.qrcode` | 数字 | `0` | 扫码登录权限：0 都可用 / 1 仅群聊 / 2 仅私聊 / 3 关闭 |
| `gclogEx` | 数字 | `5` | 更新抽卡记录的冷却时间（分钟） |
| `ck.sk` | 布尔 | `false` | 私聊发 ck 时自动换出 stoken 保存 |

也可以在锅巴（`http://<IP>:2536/guoba`）里改。

## 账号数据

账号数据保存在 `./plugins/xiaoyao-cvs-plugin/data/yaml/<QQ>.yaml`，一个 QQ 一个文件，格式：

```yaml
"100000001":
  stuid: "100000002"
  stoken: v2_xxxxxxxx
  ltoken: xxxxxxxx
  mid: xxxxxxxxxxxx_mhy
  uid: "100000001"
  userId: 100000000
  region_name: 天空岛
  region: cn_gf01
```

> 该目录已在 `.gitignore` 中排除，不会被提交。
> **文件内含登录凭证，请勿外传。**

## 其他

- [爱发电](https://afdian.net/a/Ctrlcvs)
- 图片素材来源于网络，仅供交流学习使用
- 严禁用于任何商业用途和非法行为
