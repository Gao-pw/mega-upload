import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UploadService } from './upload.service';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs-extra';
import { creatDirPath, creatOutputPath } from './util'
import { hash } from 'crypto';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) { }

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
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { hash: string; index: number; size: number; filename: string },
  ) {
    try {
      return { message: '文件上传成功' };
    } catch (error) {
      //* 捕获异常并返回错误信息
      console.error(error);
      return { message: error.message };
    }
  }

  @Post('merge')
  async mergeChunks(@Query('filename') filename: string) {
    console.log(filename);
    const chunkDir = creatDirPath(filename)
    const chunks = await fs.readdir(chunkDir);
    chunks.sort((a, b) => {
      const indexA = parseInt(a.split('.')[0], 10);
      const indexB = parseInt(b.split('.')[0], 10);
      return indexA - indexB;
    });

    const outputPath = creatOutputPath(filename);
    const writeStream = fs.createWriteStream(outputPath);

    for (const chunk of chunks) {
      const chunkPath = path.join(chunkDir, chunk);
      const chunkData = await fs.readFile(chunkPath);
      writeStream.write(chunkData);
    }

    writeStream.end();
    try{
      await fs.remove(chunkDir);
    }catch(e){
      return {message: `删除失败`}
    }
    return { message: `${filename} merged successfully` };
  }

  @Get('check/:filename/:hash/:size')
  async check(@Param('filename') filename: string, @Param('hash') hash: string, @Param('size') size: string) {
    //* 检查文件是否存在
    const isFileExist = await fs.exists(creatOutputPath(filename));

    if (isFileExist) {
      //TODO: 文件秒传
      return { code: 10003, message: '文件已存在' };
    }

    //* 检查是否有部分文件上传过
    const isDirExist = await fs.exists(creatDirPath(filename));
    if (isDirExist) {
      //* 部分文件上传的处理逻辑
      const chunkDir = creatDirPath(filename)
      const chunks = await fs.readdir(chunkDir);
      
      //* 计算已上传的文件大小
      let uploadedSize = 0;
      for (const chunk of chunks) {
        const chunkPath = path.join(chunkDir, chunk);
        const stats = await fs.stat(chunkPath);
        uploadedSize += stats.size;
      }

      //* 如果已上传的文件大小等于文件总大小，则说明已经全部上传完成。
      if(uploadedSize === parseFloat(size)){
       await this.mergeChunks(filename);
       return {code: 10003, message: '文件已上传完成' };
      }

      //* 找到最后一个上传的文件块索引，因为是从 0 开始计数的，所以最后一个文件块的索引是数组长度减一。
      const lastChunkIndex = chunks.length - 1;

      //* 返回已上传的文件大小和最后一个文件块的索引
      return {code: 10001,  uploadedSize, startNum: lastChunkIndex + 1 };
    }else{
      return {code: 10002, message: '文件不存在'}
    }

  }
}
