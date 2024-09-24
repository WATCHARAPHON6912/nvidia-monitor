const vscode = require('vscode');
const { exec } = require('child_process');

class NvidiaMonitorTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState) {
        super(label, collapsibleState);
        this.contextValue = 'nvidiaMonitorItem'; // ใช้เพื่อจัดการ context
    }
}

class NvidiaMonitorTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.currentData = {}; // เก็บข้อมูลที่อัปเดต
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) {
            const currentTime = this.getCurrentTime();
            const rootItem = new NvidiaMonitorTreeItem(`${this.currentData.device || 'N/A'}`, vscode.TreeItemCollapsibleState.Collapsed);
            return [rootItem];
        } else if (element.label.startsWith('')) {
            const gpuUsageItem = [
                new NvidiaMonitorTreeItem(`Memory Usage: ${this.currentData.memoryUsage || 'N/A'}`, vscode.TreeItemCollapsibleState.None),
                new NvidiaMonitorTreeItem(`Usage: ${this.currentData.usage || 'N/A'}`, vscode.TreeItemCollapsibleState.None),
                new NvidiaMonitorTreeItem(`Temperature: ${this.currentData.temperature || 'N/A'}`, vscode.TreeItemCollapsibleState.None),
                new NvidiaMonitorTreeItem(`view ${this.currentData.temperature || 'N/A'}`, vscode.TreeItemCollapsibleState.Collapsed)
            ]
            return gpuUsageItem;
        } else if (element.label.startsWith('view')) {
            const childItems = [
                new NvidiaMonitorTreeItem(`Device: ${this.currentData.device || 'N/A'}`, vscode.TreeItemCollapsibleState.None),
            ];
            return childItems;
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
        // รันคำสั่ง nvidia-smi
        exec('nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing nvidia-smi: ${stderr}`);
                this.currentData = {
                    device: 'Error',
                    usage: 'Error',
                    memoryUsage: 'Error',
                    temperature: 'Error'
                };
            } else {
                const lines = stdout.trim().split('\n');
                if (lines.length > 0) {
                    const [device, usage, memoryUsed, memoryTotal, temperature] = lines[0].split(', ');
                    this.currentData = {
                        device: `${device}`, // แสดงชื่ออุปกรณ์
                        usage: `${usage}%`, // แสดงหน่วย %
                        memoryUsage: `${memoryUsed} / ${memoryTotal}GB`, // แสดงหน่วย GB
                        temperature: `${temperature}°C` // แสดงหน่วย °C
                    };
                } else {
                    this.currentData = {
                        device: 'N/A',
                        usage: 'N/A',
                        memoryUsage: 'N/A',
                        temperature: 'N/A'
                    };
                }
            }
            this._onDidChangeTreeData.fire(); // อัปเดต tree view
        });
    }

    refresh() {
        this.updateData(); // เรียกใช้เพื่ออัปเดตข้อมูล
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
    }, 500); // 5000 มิลลิวินาที = 5 วินาที

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
