import { createMD5, IHasher } from "hash-wasm";

self.onmessage = async (event) => {
    try {
        const data: File = event.data;
        const chunkSize = 64 * 1024 * 1024; //* 64MB 每块大小
        const fileReader = new FileReader();
        let hasher: IHasher | null = null;

        // eslint-disable-next-line no-inner-declarations
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

        // 处理接收到的数据
        const result = await readFile(data);
        // 将结果发送回主线程
        self.postMessage(result);
    } catch (e) {
        self.postMessage(e);
    }
};