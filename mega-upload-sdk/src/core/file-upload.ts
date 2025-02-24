// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-nocheck 
import { IHasher, createMD5, md5 } from "hash-wasm";
import LowStart from "./low-start";
import { watch } from "@siroi/fe-utils";

type Toptions = {
    success_size?: number;
    success_callback?: (index: number, _success_size: number) => void;
    hash_type?: "all" | "sample";
    check: (filename: string, hash: string, size: number) => Promise<{ code: number, uploadedSize: number, startNum: number }>;
    merge?: (hash: string, filename: string) => Promise<unknown>;
    upload: (data?: Partial<{ size: number, hash: string, blob: Blob, index: number, filename: string, abortController: AbortController }>) => () => Promise<unknown>;
}

type FileUploadConstructor = {
    file: File;
    options?: Toptions;
};


/**
 * @description 文件类
 * @author siroi
 *
 * @class FileUpload
 * @typedef {FileUpload}
 */
class FileUpload {

    private file: File;

    private hash_loading: boolean = false;

    private isStop: boolean = false;
    private _watch = null;

    //* 为了兼容💩山，只能使用 Currying 的方式去传递
    private uploadFun: Toptions['upload'] = () => async () => { };

    private checkFun: Toptions['check'] = () => Promise.resolve({ code: 0, uploadedSize: 0, startNum: 0 });

    private mergeFun: (hash: string, filename: string) => Promise<unknown>;

    private hash_type: "all" | "sample" = "sample";

    //* 成功上传的文件索引数组
    private success_index = 0;

    //* 成功上传的文件大小总和
    private _success_size = 0;

    //* 上传成功的回调
    private success_callback: (index: number, _success_size: number) => void = () => { };

    public get success_size() {
        return this._success_size;
    }
    public set success_size(value) {
        this._success_size = value;
    }

    public hash: string | null = null;


    /**
     * @description 抽样计算 hash 值
     * @see https://juejin.cn/post/6844904055819468808#heading-6
     *
     * @private
     * @async
     * @returns {Promise<string>}
     */
    private async calculatedSamplingHash(): Promise<string> {
        const reader = new FileReader();
        const file = this.file;
        const size = file.size;
        const offset = 2 * 1024 * 1024;
        const chunks = [this.file.slice(0, offset)];

        let cur = offset;
        while (cur < size) {
            // 最后一块全部加进来
            if (cur + offset >= size) {
                chunks.push(file.slice(cur, cur + offset));
            } else {
                // 中间的 前中后去两个字节
                const mid = cur + offset / 2;
                const end = cur + offset;
                chunks.push(file.slice(cur, cur + 2));
                chunks.push(file.slice(mid, mid + 2));
                chunks.push(file.slice(end - 2, end));
            }
            // 前取两个字节
            cur += offset;
        }
        // 拼接
        return new Promise((resolve) => {
            reader.readAsArrayBuffer(new Blob(chunks));
            reader.onload = async (e) => {
                const hash = await md5(new Uint8Array(e.target?.result as Uint8Array));

                resolve(hash);
            };
        });
    }


    /**
     * @description 计算全量 hash 值
     * @author siroi
     * @deprecated 使用 worker 计算，还是很慢
     * @async
     * @returns {unknown}
     */
    private calculatedAllhash = async (): Promise<string> => {
        const chunkSize = 64 * 1024 * 1024; //* 64MB 每块大小
        const fileReader = new FileReader();
        let hasher: IHasher | null = null;

        function hashChunk(chunk: Blob) {
            return new Promise((resolve) => {
                fileReader.onload = async (e) => {
                    const view = new Uint8Array(e.target?.result as ArrayBuffer);
                    hasher?.update(view);
                    //@ts-expect-error 忽略错误
                    resolve();
                };

                fileReader.readAsArrayBuffer(chunk);
            });
        }

        const readFile = async (file: File) => {
            if (hasher) {
                hasher.init();
            } else {
                hasher = await createMD5();
            }

            const chunkNumber = Math.floor(file.size / chunkSize);

            for (let i = 0; i <= chunkNumber; i++) {
                const chunk = file.slice(
                    chunkSize * i,
                    Math.min(chunkSize * (i + 1), file.size),
                );
                await hashChunk(chunk);
            }

            const hash = hasher.digest();
            return Promise.resolve(hash);
        };

        return readFile(this.file);
    };

    private async createHashAndBlob() {
        this.hash_loading = true;

        if (this.hash_type === "all") {
            this.hash = await this.all_workder();
        } else {
            this.hash = await this.calculatedSamplingHash();
        }

        this.hash_loading = false;
    }


    constructor(props: FileUploadConstructor) {
        this.file = props.file;
        this.success_size = props.options?.success_size || 0;
        this.success_callback = props.options?.success_callback || (() => { });
        this.hash_type = props.options?.hash_type || "sample";
        if (props.options?.upload) {
            this.uploadFun = props.options?.upload;
        }

        if (props.options?.check) {
            this.checkFun = props.options.check;
        }

        this.mergeFun = props.options?.merge || (async () => { });
    }

    public add_success_callback(fun: () => void) {
        this.success_callback = fun;
    }

    //* 服务器校验
    private async server_check() {
        //todo 更新 上传进度 success_size
        const { code, uploadedSize, startNum } = await this.checkFun(this.file.name, this.hash, this.file.size);
        if (code === 10001) {
            this.success_size = uploadedSize;
            this.success_index = startNum;
        }

        if (code === 10003) {
            return true;
        } else {
            return false;
        }
    }

    public async upload(cb: (status: boolean, progress?: { success_size: number, success_index?: number }) => void) {
        this.isStop = false;
        //* 先计算 hash
        await this.createHashAndBlob();

        //todo 此处需要对历史的 hash 进行校验
        const status = await this.server_check();
        if (status) {
            //* 已经上传完了直接返回结果：文件秒传
            cb(true, { success_size: this.file.size });
            return true;
        }

        //* 创建慢上传对象
        const lowStart = new LowStart();

        let abortController = null;


        //todo 断点续传

        while ((this.success_size < this.file.size) && this.isStop === false) {
            try {
                const size = Math.min(lowStart.chunkWindowSize, this.file.size - this.success_size);

                abortController = new AbortController();

                this._watch = watch(this.isStop, (newVal) => {
                    if (newVal) {
                        abortController?.abort();
                    }
                });

                //* 读取当前区块的 blob 数据
                const blob = this.file.slice(this.success_size, this.success_size + size);

                await lowStart.changeSize(this.uploadFun({ blob: blob, hash: this.hash!, index: this.success_index, filename: this.file.name, abortController, size }), {
                    abortController,
                    stop: this.isStop,
                });

                this.success_size += size;
                this.success_index += 1;

                cb(false, { success_size: this.success_size, success_index: this.success_index });

                // this.success_callback(this.file.size, this.success_size, );
            }
            catch (e) {
                console.log(e);
                this.isStop = true;
                break;
            }
        }

        console.log("上传进度", this.success_size, this.file.size);

        if (this.success_size === this.file.size) {
            //* 调用 合并 接口
            await this.mergeFun(this.hash!, this.file.name);
            cb(true, {success_size: this.success_size });
        }


    }

    //* 暂停上传
    public async stop() {
        console.log("暂停上传");
        this.isStop = true;
        if (this._watch !== null) {
            this._watch.value = true;
        }
    }

    private async all_workder(): Promise<string> {
        const worker = new Worker(new URL('../worker/hash.js', import.meta.url), { type: 'module' });

        // 向 worker 发送消息
        worker.postMessage(this.file);

        return new Promise((resolve) => {
            // 监听 worker 的消息
            worker.onmessage = (event) => {
                const result: string = event.data;
                resolve(result);
            };
        });
    }
}

export default FileUpload;