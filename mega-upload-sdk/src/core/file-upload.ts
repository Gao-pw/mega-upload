import { IHasher, createMD5, md5 } from "hash-wasm";

type FileUploadConstructor = {
    file: File;
    options?: {
        success_size?: number;
        success_callback?: (index: number, _success_size: number) => void;
        hash_type?: "all" | "sample";
    };
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
     * @description 计算全量 hash 值 => 改为 worker 计算，还是很慢
     * @author siroi
     *
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

        return this.hash;
    }


    constructor(props: FileUploadConstructor) {
        this.file = props.file;
        this.success_size = props.options?.success_size || 0;
        this.success_callback = props.options?.success_callback || (() => { });
        this.hash_type = props.options?.hash_type || "sample";
    }

    public add_success_callback(fun: () => void) {
        this.success_callback = fun;
    }

    public async upload() {
        this.createHashAndBlob();
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