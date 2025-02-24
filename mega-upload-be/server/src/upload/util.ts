//@ts-nocheck
import multer, { Multer } from 'multer';
import * as path from 'path';
import * as fs from 'fs-extra';

function creatDirPath(filename: string) {
    const _path = path.join(__dirname, '..', '..', 'public', `temp-${filename}`);
    return _path;
}

function creatOutputPath(filename: string) {
    return path.join(__dirname, '..', '..', 'public', filename);
}

function customEngine(
    options: multer.DiskStorageOptions,
): multer.StorageEngine {
    return {
        //@ts-ignore
        _handleFile: async (
            req: Request,
            file: Express.Multer.File,
            cb: (error?: any, info?: Partial<Express.Multer.File>) => void,
        ) => {
            const { filename, destination } = options;

            if (destination instanceof Function) {
                destination(req, file, (error, _path) => {
                    if (error) return cb(error);

                    if (filename instanceof Function) {
                        filename(req, file, (error, filename) => {
                            if (error) return cb(error);

                            //* 创建一个文件流
                            const filePath = path.join(_path, filename);
                            const writeStream = fs.createWriteStream(filePath);

                            const file_stream = file.stream;

                            let isStreamDestroyed = false;

                            const destroyStreamsAndRemoveFile = (err: any) => {
                                if (!isStreamDestroyed) {
                                    file.stream.destroy();
                                    writeStream.destroy();
                                    isStreamDestroyed = true;
                                    console.log('流已销毁');
                                    cb(err);
                                }
                            };

                            try {
                                // 监听写入错误
                                writeStream.on('error', (err) => {
                                    console.log('写入错误');
                                    destroyStreamsAndRemoveFile(err);
                                });

                                // 监听请求关闭事件，主动关闭流
                                req.on('close', () => {
                                    console.log('请求关闭');
                                    destroyStreamsAndRemoveFile(new Error('请求关闭'));
                                });

                                // 监听文件流错误
                                file_stream.on('error', (err) => {
                                    console.log('文件流错误');
                                    destroyStreamsAndRemoveFile(err);
                                });

                                // 检查流状态，避免向已销毁的流写入数据
                                if (!file_stream.destroyed && !writeStream.destroyed) {
                                    file_stream.pipe(writeStream);
                                }

                                // 等待写入完成
                                writeStream.on('finish', () => {
                                    cb(null, {
                                        ...file,
                                        filename: file.originalname,
                                        path: filePath,
                                    });
                                });
                            } catch (error) {
                                console.log('出现异常');
                                destroyStreamsAndRemoveFile(error);
                            }
                        });
                    }
                });
            }
        },
        _removeFile: () => { },
    };
}

export { creatDirPath, creatOutputPath, customEngine };
