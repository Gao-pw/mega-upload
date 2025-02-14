class FileSize {

    public floor(num: number): number {
        return num.toFixed(2) as unknown as number;
    }

    public byteToKb(bytes: number): number {
        return this.floor(bytes / 1024);
    }

    public byteToMb(bytes: number): number {
        return this.floor(bytes / 1024 / 1024);
    }

    public mbToBytes(mb: number): number {
        return this.floor(mb * 1024 * 1024);
    }

    public kbToBytes(kb: number): number {
        return this.floor(kb * 1024);
    }
}

const fileSize = new FileSize();

export default fileSize;