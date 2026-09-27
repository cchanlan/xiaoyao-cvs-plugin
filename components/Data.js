import fs from "fs";
import path from 'node:path'
const _path = process.cwd()

let Data = {

	/*
	 * 根据指定的path依次检查与创建目录
	 * */
	createDir(rootPath = "", path = "", includeFile = false) {
		let pathList = path.split("/"),
			nowPath = rootPath;
		pathList.forEach((name, idx) => {
			name = name.trim();
			if (!includeFile && idx <= pathList.length - 1) {
				nowPath += name + "/";
				if (name) {
					if (!fs.existsSync(nowPath)) {
						fs.mkdirSync(nowPath);
					}
				}
			}
		})
	},

	/*
	 * 读取json
	 * */
	readJSON(root, path) {
		if (!/\.json$/.test(path)) {
			path = path + ".json";
		}
		// 检查并创建目录
		Data.createDir(root, path, true);
		if (fs.existsSync(`${root}/${path}`)) {
			let jsonRet = fs.readFileSync(`${root}/${path}`, "utf8");
			return JSON.parse(jsonRet);
		}
		return {}
	},
	mkdirs(dirname) {
		if (fs.existsSync(dirname)) {
			return true
		} else {
			if (Data.mkdirs(path.dirname(dirname))) {
				fs.mkdirSync(dirname)
				return true
			}
		}
	},
	async importModule(path, file, rootPath = _path) {
		if (!/\.js$/.test(file)) {
			file = file + '.js'
		}
		// 检查并创建目录
		Data.createDir(_path, path, true)
		if (fs.existsSync(`${_path}/${path}/${file}`)) {
			let data = await import(`file://${_path}/${path}/${file}`)
			return data || {}
		}
		return {}
	},

	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

}

export default Data;
