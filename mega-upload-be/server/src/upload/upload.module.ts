import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { creatDirPath, customEngine } from './util';
import * as fs from 'fs-extra';

@Module({
  imports: [
    MulterModule.registerAsync({
      useFactory: async () => ({
        storage: diskStorage({
          destination: (req, file, cb) => {
            const _path = creatDirPath(req.body.filename);
            fs.ensureDirSync(_path);
            return cb(null, _path) ;
          },
          filename: async (req, file, cb) => {
            const { hash, index, size, filename: originalname } = req.body;
            req.on('error', () => {
              console.log('强制关闭 http 流');
              cb({message: '文件上传中止', name: 'file-stop'}, `${index}.${originalname}.${hash}`);
            });
            //* 否则存为最终文件
            return cb(null, `${index}.${originalname}.${hash}`);
          },
        }),
      }),
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule { }
