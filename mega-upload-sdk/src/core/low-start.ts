import { watch } from "@siroi/fe-utils";
import fileSize from "@/utils/size";
import requestPool from "./max-request";


/**
 * @description 慢上传策略，根据网速调整每一个的上传区块大小，以达到最佳上传文件的目的。
 * @see 参考 tcp 拥塞控制算法，慢启动算法。
 * @author siroi
 *
 * @class LowStart
 * @typedef {LowStart}
 */
class LowStart {

    static defalutSize = fileSize.kbToBytes(256);

    //* 上传区块大小， 默认 256 KB
    private _chunkWindowSize = (1 * LowStart.defalutSize);

    //* 调整次数
    private _acknum = 1;

    //* 网络传输阈值，只要 5s 内上传完成，则认为网络畅通。
    private _threshold = 5000;
    public get chunkWindowSize() {
        return this._chunkWindowSize;
    }
    public set chunkWindowSize(value) {
        this._chunkWindowSize = value;
    }


    public async changeSize(upload: <T, U extends unknown[]>(...args: U) => Promise<T>, context: {abortController: AbortController, stop: boolean}) {
        const {abortController, stop} = context;

        const tmp = {value: stop};

        console.log(abortController, stop, tmp);

        //* 监听 stop 信号，如果停止上传，则中断请求。
        watch(tmp, (current) => {
            console.log("stop", current);
            //@ts-expect-error  best practice, but it's ok here.
            if(current.value === true){
                abortController.abort();
            }
        });

        
        const { data, ConsumptionTime } = await requestPool.run(upload);

        //* 实际消耗时间，单位 ms
        const real_consumption = ConsumptionTime;

        //* 分段阈值
        const segment_threshold = (this._threshold * (3 / 4));

        if (real_consumption <= this._threshold) {

            if (real_consumption === this._threshold) {
                //! nothing to do
                return data;
            }

            if (real_consumption < segment_threshold) {
                //* 网络非常畅通，翻倍区块大小
                this.chunkWindowSize += (Math.pow(this._acknum, 2) * LowStart.defalutSize);
            }

            if (real_consumption >= segment_threshold) {
                //* 此时网速不满足，小幅调整区块大小, 逐渐逼近网速阈值, +1
                this.chunkWindowSize += (1 * LowStart.defalutSize);
            }
            this._acknum += 1;

        } else {
            //! 拥塞发生，需要调整
            if (this._acknum === 1) {
                //! 第一次就拥塞，减少 窗口 大小, 每次减少 1/3 左右；
                this.chunkWindowSize = (this.chunkWindowSize * (2 / 3));
            } else {
                this.chunkWindowSize = Math.floor(this.chunkWindowSize / 2);
                //! 重置调整次数，重新开始计算
                this._acknum = 1;
                this._threshold = 5000;
            }
        }
        return data;
    }
}


export default LowStart;