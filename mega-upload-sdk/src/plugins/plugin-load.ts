//@ts-nocheck 暂时忽略类型检查
class PluginCycle {

    private plugin_store = {
        init: [],
        hash: [],
        before_upload: [],
        after_upload: []
    };

    public mount(plugin_name: 'init'|'hash'|'before_upload'| 'after_upload', plugin_func: () => void) {
        this.plugin_store[plugin_name].push(plugin_func);
    }

    public init_cycle(){
        //* 初始化调用插件, 暂时没啥用
    }

    public hash_cycle(){
        //* 计算 hash 期间的调用
    }

    public before_upload_cycle(file: File){
        //* 上传前的调用插件， 可以对 file 文件进行处理
        this.plugin_store['before_upload'].forEach(plugin => {
            plugin(file)
        })
    }

    public after_upload_cycle(current_index: number, total_size: number){
        //* 上传后的调用插件
        this.plugin_store['after_upload'].forEach(plugin => {
            plugin(current_index, total_size);
        })
    }

    public destroy_cycle(){
        //* 销毁插件
    }
}

const plugin_cycle = new PluginCycle();

export default plugin_cycle;