const vscode = require('vscode');
const { exec } = require('child_process');

class NvidiaMonitorTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState) {
        super(label, collapsibleState);
        this.contextValue = 'nvidiaMonitorItem';
    }
}

class NvidiaMonitorTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.currentData = {};
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) {
            const currentTime = this.getCurrentTime();
            const rootItem = [
                new NvidiaMonitorTreeItem(`${this.currentData.device || 'N/A'}`, vscode.TreeItemCollapsibleState.Collapsed),
                new NvidiaMonitorTreeItem(`CPU`, vscode.TreeItemCollapsibleState.Collapsed),
            ];
            return rootItem;
        }  else if (element.label.startsWith(`${this.currentData.device || 'N/A'}`)) {
            return [
                new NvidiaMonitorTreeItem(`GPU: ${this.currentData.usage || 'N/A'} %`, vscode.TreeItemCollapsibleState.None),
                new NvidiaMonitorTreeItem(`Memory: ${this.currentData.memoryUsage || 'N/A'}`, vscode.TreeItemCollapsibleState.None),
                new NvidiaMonitorTreeItem(`Temp: ${this.currentData.temperature || 'N/A'}`, vscode.TreeItemCollapsibleState.None)
            ];
        } 
        else if (element.label.startsWith(`CPU`)) {
            return [
                new NvidiaMonitorTreeItem(`CPU: ${this.currentData.cpuUsage || 'N/A'} %`, vscode.TreeItemCollapsibleState.None),
                new NvidiaMonitorTreeItem(`RAM: ${this.currentData.ramUsage || 'N/A'} GB`, vscode.TreeItemCollapsibleState.None),
            ];
        } 
        return [];
    }

    getCurrentTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    updateData() {
        const platform = process.platform;
        let nvidiaCommand, cpuCommand, ramCommand;

        if (platform === 'win32') {
            nvidiaCommand = 'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits';
            cpuCommand = 'wmic cpu get loadpercentage /value';
            ramCommand = 'wmic OS get FreePhysicalMemory , TotalVisibleMemorySize /value';
        } else if (platform === 'linux') {
            nvidiaCommand = 'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits';
            cpuCommand = 'top -bn1 | grep "Cpu(s)" | awk \'{print $2 + $4}\'';
            ramCommand = 'cat /proc/meminfo | grep -E \'MemTotal|MemFree\'';
        } else {
            console.error('Unsupported OS');
            return;
        }

        exec(nvidiaCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing nvidia-smi: ${stderr}`);
                this.currentData.device = 'Error';
                this.currentData.usage = 'Error';
                this.currentData.memoryUsage = 'Error';
                this.currentData.temperature = 'Error';
            } else {
                const lines = stdout.trim().split('\n');
                if (lines.length > 0) {
                    const [device, usage, memoryUsed, memoryTotal, temperature] = lines[0].split(', ');
                    this.currentData.device = `${device}`;
                    this.currentData.usage = `${usage}`;
                    this.currentData.memoryUsage = `${(memoryUsed/ 1024).toFixed(2)} / ${(memoryTotal/ 1024).toFixed(2)}GB`;
                    this.currentData.temperature = `${temperature}°C`;
                } else {
                    this.currentData.device = 'N/A';
                    this.currentData.usage = 'N/A';
                    this.currentData.memoryUsage = 'N/A';
                    this.currentData.temperature = 'N/A';
                }
            }

            exec(cpuCommand, (error, stdout, stderr) => {
                if(platform === 'win32'){
                    if (error) {
                        console.error(`Error executing CPU command: ${stderr}`);
                        this.currentData.cpuUsage = 'Error';
                    } else {
                        this.currentData.cpuUsage = `${stdout.trim().split('=')[1]}`;
                    }
                }
                else{
                    this.currentData.cpuUsage = stdout.trim();
                }

            exec(ramCommand, (error, stdout, stderr) => {
                if(platform === 'win32'){
                    if (error) {
                        console.error(`Error executing RAM command: ${stderr}`);
                        this.currentData.ramUsage = 'Error';
                    } else {
                        var x=stdout.trim().split('\n');
                        var free=x[0].split('=')[1];
                        var total=x[1].split('=')[1]
                        this.currentData.ramUsage = `${((total-free)/ (1024 * 1024)).toFixed(2)}/${(total/ (1024 * 1024)).toFixed(2)}`;
                    }
                }else{
                    if (error) {
                        console.error(`Error executing RAM command: ${stderr}`);
                        this.currentData.ramUsage = 'Error';
                    } else {
                        var x=stdout.trim().split('\n');
                        var total=x[0].split(':')[1].split("kB")[0];
                        var free=x[1].split(':')[1].split("kB")[0];
                        this.currentData.ramUsage = `${((total-free)/ (1024 * 1024)).toFixed(2)}/${(total/ (1024 * 1024)).toFixed(2)}`;
                    }
                }
                this._onDidChangeTreeData.fire(); // อัปเดต tree view
                });
            });
        });
    }

    refresh() {
        this.updateData();
    }
}

function activate(context) {
    console.log('Congratulations, your extension "nvidia-monitor" is now active!');

    const nvidiaMonitorTreeDataProvider = new NvidiaMonitorTreeDataProvider();
    
    vscode.window.createTreeView('nvidiaMonitorView', { treeDataProvider: nvidiaMonitorTreeDataProvider });

    const refreshCommand = vscode.commands.registerCommand('nvidia-monitor.refresh', () => {
        nvidiaMonitorTreeDataProvider.refresh();
        vscode.window.showInformationMessage('NVIDIA Monitor data refreshed!');
    });

    // ตั้งเวลาอัปเดตข้อมูลทุก 5 วินาที
    const interval = setInterval(() => {
        nvidiaMonitorTreeDataProvider.refresh();
        console.log('NVIDIA Monitor data auto-refreshed');
    }, 500);

    context.subscriptions.push(refreshCommand);
    context.subscriptions.push({
        dispose: () => clearInterval(interval)
    });
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
