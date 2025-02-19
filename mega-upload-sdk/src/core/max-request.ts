import {dayjs} from '@siroi/fe-utils'

/**
 * @description 请求池，用于限制同时进行的异步操作数量，以避免过多的并发请求对浏览器的压力
 * @author siroi
 *
 * @class RequestPool
 * @typedef {RequestPool}
 */
class RequestPool {
    private static POOL_SIZE = 6;

    constructor(private pool: (() => Promise<any>)[] = []) {}

    public async run(request: () => Promise<any>) {
        //* 当请求池达到最大容量时，等待最早加入的请求完成
        if (this.pool.length >= RequestPool.POOL_SIZE) {
            await Promise.race(this.pool);
            //! 移除已经完成的请求
            this.pool = this.pool.filter(promise => !(promise as any)[Symbol.for('isResolved')]);
        }

        //* 标记请求是否完成的辅助属性
        const wrappedRequest = (): Promise<any> => request()
           .then(() => {
            (request as any)[Symbol.for('isResolved')] = true;
            })
           .catch(() => {
            (request as any)[Symbol.for('isResolved')] = true;
            });

        // 将请求添加到请求池
        this.pool.push(wrappedRequest);

        const before_time = dayjs().valueOf();
        // 执行请求
        const data = await wrappedRequest();

        const after_time = dayjs().valueOf();

        return {
            data,
            ConsumptionTime: after_time - before_time,
        } as const;
    }
}

const pool = new RequestPool();

export default pool;