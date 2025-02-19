import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UploadService } from './upload.service';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get('file')
  hello(): string {
    return 'hello siroi';
  }

  /**
   * @description 上传文件块
   * @author siroi
   *
   *! hash: 文件的唯一标识
   *! index: 当前文件的块索引
   *! size: 当前文件块的大小
   *
   * @param {{hash: string, index: number, size: number}} body
   */
  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file:Express.Multer.File,
    @Body() body: { hash: string; index: number; size: number },
  ) {
    console.log(file, body);
    return 'hello2';
  }
}
