const { Plugin, PluginSettingTab, Setting, MarkdownRenderChild, Notice } = require('obsidian');
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
    progressTerm: 'current_progress',
    totalTerm: 'total',
    barColor: '#4caf50',
    backgroundColor: '#e0e0e0',
    animation: 'smooth',
    transitionDuration: '0.5s',
    legendFontSize: '0.8em',
    total: 100,
    enableResetOnRightClick: true, // Right-click to enable/disable reset
};

class InteractiveProgressBarPlugin extends Plugin {
    async onload() {
        await this.loadSettings();

        this.registerMarkdownCodeBlockProcessor('progress-bar', (source, el, ctx) => {
            const progressBar = new ProgressBar(source, this, ctx.sourcePath);
            el.appendChild(progressBar.render());
            progressBar.initializeProgressBarClick();
        });

        this.addSettingTab(new ProgressBarSettingTab(this.app, this));

        this.clearOldEntries(); // Nettoyer les anciennes entrées chaque jour
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getMemoryFilePath() {
        return path.join(this.app.vault.adapter.basePath, 'progressBarMemory.json');
    }

    loadMemoryData() {
        const filePath = this.getMemoryFilePath();
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        }
        return {};
    }

    saveMemoryData(data) {
        const filePath = this.getMemoryFilePath();
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    clearOldEntries() {
        const data = this.loadMemoryData();
        const today = new Date().toISOString().slice(0, 10);

        Object.keys(data).forEach(key => {
            if (data[key].date !== today) {
                delete data[key];
            }
        });

        this.saveMemoryData(data);
    }
}

class ProgressBar extends MarkdownRenderChild {
    constructor(source, plugin, notePath) {
        super();
        this.plugin = plugin;
        this.notePath = notePath;
        this.progress = 0;
        this.color = this.plugin.settings.barColor;
        this.backgroundColor = this.plugin.settings.backgroundColor;
        this.increment = 10;
        this.width = '100%';
        this.height = '30px';
        this.legend = '';
        this.animation = this.plugin.settings.animation;
        this.transitionDuration = this.plugin.settings.transitionDuration;
        this.legendFontSize = this.plugin.settings.legendFontSize;
        this.name = '';
        this.id = `progress-bar-${Math.random().toString(36).substr(2, 9)}`;
        this.parseSource(source);

        this.loadProgressFromMemory();  // Loading progress from memory
    }

    parseSource(source) {
        const params = source.split(/[\n,]+/);  // Support for comma-separated options or new lines
        params.forEach(param => {
            const [key, value] = param.split(':').map(str => str.trim());
            if (key === 'initialProgress') {
                this.progress = parseInt(value, 10);
            } else if (key === 'total') {
                this.total = parseInt(value, 10);
            } else if (key === 'color') {
                this.color = value;
            } else if (key === 'backgroundColor') {
                this.backgroundColor = value;
            } else if (key === 'increment') {
                this.increment = parseInt(value, 10);
            } else if (key === 'width') {
                this.width = value;
            } else if (key === 'height') {
                this.height = value;
            } else if (key === 'legend') {
                this.legend = value;
            } else if (key === 'animation') {
                this.animation = value;
            } else if (key === 'transitionDuration') {
                this.transitionDuration = value;
            } else if (key === 'legendFontSize') {
                this.legendFontSize = value;
            } else if (key === 'name') {
                this.name = value.replace(/[^a-zA-Z]/g, '');  // Filter non-alphabetic characters
            }
        });

        if (!this.name) {
            console.error('The name field is required and must be alphabetic.');
            this.name = `bar-${Math.random().toString(36).substr(2, 5)}`;
        }
    }

    loadProgressFromMemory() {
        const data = this.plugin.loadMemoryData();
        const today = new Date().toISOString().slice(0, 10);
        const memoryKey = `${this.notePath}-${this.name}`;

        if (data[memoryKey] && data[memoryKey].date === today) {
            this.progress = data[memoryKey].progress;
        } else {
            this.progress = 0;
        }
    }

    saveProgressToMemory() {
        const data = this.plugin.loadMemoryData();
        const today = new Date().toISOString().slice(0, 10);
        const memoryKey = `${this.notePath}-${this.name}`;

        data[memoryKey] = {
            date: today,
            progress: this.progress
        };

        this.plugin.saveMemoryData(data);
    }

    incrementProgress() {
        if (this.progress < this.total) {
            this.progress += this.increment;
            if (this.progress > this.total) this.progress = this.total;
        } else {
            this.progress = 0;  // Resets to 0 if progress is 100%.
        }
        this.progressBar.style.width = `${(this.progress / this.total) * 100}%`;

        if (this.animation === 'wave') {
            this.progressBar.style.animation = 'wave-animation 2s linear';
            setTimeout(() => {
                this.progressBar.style.animation = 'none';
            }, parseFloat(this.transitionDuration) * 1000);
        }

        if (this.legend) {
            this.updateLegend();
        }

        this.saveProgressToMemory();  // Saving progress
    }

    render() {
        const containerEl = document.createElement('div');
        containerEl.style.display = 'flex';
        containerEl.style.flexDirection = 'column';
        containerEl.style.marginBottom = '1em';
    
        const progressBarContainer = document.createElement('div');
        progressBarContainer.style.display = 'flex';
        progressBarContainer.style.alignItems = 'center';
        progressBarContainer.style.backgroundColor = this.backgroundColor;
        progressBarContainer.style.borderRadius = '5px';
        progressBarContainer.style.overflow = 'hidden';
        progressBarContainer.style.width = this.width;
        progressBarContainer.style.height = this.height;
        progressBarContainer.style.cursor = 'pointer';
        progressBarContainer.style.position = 'relative';
    
        this.progressBar = document.createElement('div');
        this.progressBar.style.width = `${(this.progress / this.total) * 100}%`;
        this.progressBar.style.height = '100%';
        this.progressBar.style.backgroundColor = this.color;
        this.applyAnimation();
    
        progressBarContainer.appendChild(this.progressBar);
        containerEl.appendChild(progressBarContainer);
    
        if (this.legend) {
            this.legendEl = document.createElement('div');
            this.legendEl.style.fontSize = this.legendFontSize;
            this.legendEl.style.textAlign = 'center';
            this.updateLegend();
            containerEl.appendChild(this.legendEl);
        }
    
        return containerEl;
    }
    

    applyAnimation() {
        switch (this.animation) {
            case 'instant':
                this.progressBar.style.transition = 'none';
                break;
            case 'wave':
                this.progressBar.style.transition = `width ${this.transitionDuration} ease-in-out`;
                // Applique l'animation d'onde si activée
                this.progressBar.style.backgroundImage = `url('data:image/svg+xml;base64,${waveSVG}')`;
                this.progressBar.style.backgroundSize = '200% 200%';
                break;
            case 'smooth':
            default:
                this.progressBar.style.transition = `width ${this.transitionDuration}`;
                break;
        }
    }

    updateLegend() {
        const current = (this.progress / this.total) * this.total;
        this.legendEl.innerText = this.legend
            .replace(`{${this.plugin.settings.progressTerm}}`, `${current.toFixed(0)}`)
            .replace(`{${this.plugin.settings.totalTerm}}`, `${this.total}`);
    }

    initializeProgressBarClick() {
        // Left-click listener added (increment progression)
        this.progressBar.parentElement.addEventListener('click', (event) => {
            if (event.button === 0) { // 0 correspond au clic gauche
                this.incrementProgress();
            }
        });
    
        // Checks whether right-click reset is enabled in settings
        if (this.plugin.settings.enableResetOnRightClick) {
            // Ajout d'un écouteur pour le clic droit (réinitialiser la progression)
            this.progressBar.parentElement.addEventListener('contextmenu', (event) => {
                event.preventDefault(); // Empêche le menu contextuel par défaut
                this.resetProgress();
            });
        }
    }    

    // Method for resetting progress to 0
    resetProgress() {
        this.progress = 0;
        this.progressBar.style.width = '0%';

        if (this.animation === 'wave') {
            this.progressBar.style.animation = 'wave-animation 2s linear';
            setTimeout(() => {
                this.progressBar.style.animation = 'none';
            }, parseFloat(this.transitionDuration) * 1000);
        }

        if (this.legend) {
            this.updateLegend();
        }

        this.saveProgressToMemory(); // Save reset state
    }
}


class ProgressBarSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;

        containerEl.empty();
        containerEl.createEl('h2', { text: 'Interactive Progress Bar Settings' });

        // Parameter to define the term used for current progress
        new Setting(containerEl)
            .setName('Progress Term')
            .setDesc('The term to use for the current progress in the legend.')
            .addText(text => text
                .setPlaceholder('current_progress')
                .setValue(this.plugin.settings.progressTerm)
                .onChange(async (value) => {
                    this.plugin.settings.progressTerm = value;
                    await this.plugin.saveSettings();
                }));

        // Parameter to define the term used for the total
        new Setting(containerEl)
            .setName('Total Term')
            .setDesc('The term to use for the total in the legend.')
            .addText(text => text
                .setPlaceholder('total')
                .setValue(this.plugin.settings.totalTerm)
                .onChange(async (value) => {
                    this.plugin.settings.totalTerm = value;
                    await this.plugin.saveSettings();
                }));

        // Parameter to define the default color of the bar
        new Setting(containerEl)
            .setName('Default Bar Color')
            .setDesc('The default color of the progress bar.')
            .addText(text => text
                .setPlaceholder('#4caf50')
                .setValue(this.plugin.settings.barColor)
                .onChange(async (value) => {
                    this.plugin.settings.barColor = value;
                    await this.plugin.saveSettings();
                }));

        // Set the default background color for the bar
        new Setting(containerEl)
            .setName('Default Background Color')
            .setDesc('The default background color of the progress bar.')
            .addText(text => text
                .setPlaceholder('#e0e0e0')
                .setValue(this.plugin.settings.backgroundColor)
                .onChange(async (value) => {
                    this.plugin.settings.backgroundColor = value;
                    await this.plugin.saveSettings();
                }));

        // Parameter for choosing the type of bar animation
        new Setting(containerEl)
            .setName('Animation Type')
            .setDesc('The type of animation for the progress bar.')
            .addDropdown(dropdown => dropdown
                .addOption('instant', 'Instant')
                .addOption('smooth', 'Smooth')
                .addOption('wave', 'Wave')
                .setValue(this.plugin.settings.animation)
                .onChange(async (value) => {
                    this.plugin.settings.animation = value;
                    await this.plugin.saveSettings();
                }));

        // Parameter for defining animation transition duration
        new Setting(containerEl)
            .setName('Transition Duration')
            .setDesc('The duration of the transition animation.')
            .addText(text => text
                .setPlaceholder('0.5s')
                .setValue(this.plugin.settings.transitionDuration)
                .onChange(async (value) => {
                    this.plugin.settings.transitionDuration = value;
                    await this.plugin.saveSettings();
                }));

        // Parameter to define the caption font size
        new Setting(containerEl)
            .setName('Legend Font Size')
            .setDesc('The font size of the legend text.')
            .addText(text => text
                .setPlaceholder('0.8em')
                .setValue(this.plugin.settings.legendFontSize)
                .onChange(async (value) => {
                    this.plugin.settings.legendFontSize = value;
                    await this.plugin.saveSettings();
                }));

        // Parameter to define the total value representing 100% of the progression
        new Setting(containerEl)
            .setName('Total Value')
            .setDesc('The total value representing 100% progress.')
            .addText(text => text
                .setPlaceholder('100')
                .setValue(this.plugin.settings.total)
                .onChange(async (value) => {
                    this.plugin.settings.total = parseInt(value);
                    await this.plugin.saveSettings();
                }));

        // Parameter to enable/disable right-click reset
        new Setting(containerEl)
            .setName('Enable Reset on Right Click')
            .setDesc('Allow resetting the progress bar to 0 with a right-click.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableResetOnRightClick)
                .onChange(async (value) => {
                    this.plugin.settings.enableResetOnRightClick = value;
                    await this.plugin.saveSettings();
                }));

        // Adding a separator
        containerEl.createEl('hr');

        // Documentation section
        containerEl.createEl('h2', { text: 'Documentation' });
        containerEl.createEl('p', { text: 'This plugin allows you to create interactive progress bars in your markdown files. Below are the available options and examples.' });

        containerEl.createEl('h3', { text: 'Available Options' });
        containerEl.createEl('ul', null, (ul) => {
            ul.createEl('li', { text: 'initialProgress: The initial progress percentage (0-100).' });
            ul.createEl('li', { text: 'total: The total value representing 100% progress.' });
            ul.createEl('li', { text: 'color: The color of the progress bar.' });
            ul.createEl('li', { text: 'backgroundColor: The background color of the progress bar.' });
            ul.createEl('li', { text: 'increment: The percentage to increase the progress bar on each click.' });
            ul.createEl('li', { text: 'width: The width of the progress bar.' });
            ul.createEl('li', { text: 'height: The height of the progress bar.' });
            ul.createEl('li', { text: 'legend: The legend text to display below the progress bar.' });
            ul.createEl('li', { text: 'animation: The animation type ("instant", "smooth", "wave").' });
            ul.createEl('li', { text: 'transitionDuration: The duration of the transition animation.' });
            ul.createEl('li', { text: 'legendFontSize: The font size of the legend text.' });
            ul.createEl('li', { text: 'enableResetOnRightClick: Allows the progress bar to be reset to 0 with a right-click.' });
        });

        containerEl.createEl('h3', { text: 'Examples' });
        containerEl.createEl('p', { text: 'Below are some examples of how to use the progress bar in your markdown files.' });

        containerEl.createEl('pre', null, (pre) => {
            pre.createEl('code', {
                text: `\`\`\`progress-bar
initialProgress: 50
total: 200
color: #ff0000
backgroundColor: #000000
increment: 5
width: 100%
height: 30px
legend: "Progress: {current_progress}/{total}"
animation: wave
transitionDuration: 1s
legendFontSize: 1em
\`\`\``
            });
        });

        containerEl.createEl('pre', null, (pre) => {
            pre.createEl('code', {
                text: `\`\`\`progress-bar
initialProgress: 70
total: 150
color: #00ff00
width: 80%
height: 20px
legend: "Completed: {current_progress}%"
animation: smooth
\`\`\``
            });
        });
    }
}

module.exports = InteractiveProgressBarPlugin;

// Add wave animation keyframes
const style = document.createElement('style');
style.innerHTML = `
    @keyframes wave-animation {
        0% { background-position: 0 0; }
        100% { background-position: 200% 0; }
    }
`;
document.head.appendChild(style);
