import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Module({
  imports: [
    MulterModule.registerAsync({
      useFactory: async () => ({
        storage: diskStorage({
          destination: './public',
          filename: (req, file, cb) => {
            const {hash, index, size} = req.body;
            const { originalname } = file;
            
            //* 如果没传完，就先存为tmp文件
            if(file.size === undefined){
              return cb(null, `${originalname}.${hash}.${index}.tmp`)
            }
            //* 否则存为最终文件
            return cb(null, `${originalname}.${hash}.${index}`);
          },
        }),
      }),
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
