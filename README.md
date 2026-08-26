# 📄 Obsidian Interactive Progress Bar Plugin

👋 **Welcome to the Obsidian Interactive Progress Bar Plugin repository!**

This plugin allows you to add **interactive progress bars** to your Obsidian notes. With this plugin, you can easily track your goals, habits, or project progress directly within your markdown files. The progress bars are fully customizable and can be updated by simply clicking on them.

## 🚀 Features Available

- 📊 **Interactive progress bars**: Add customizable progress bars to your notes.
- 🔄 **Progress persistence**: The progress is saved and remains across sessions.
- 🖱️ **Click to progress**: Click on the bar to increment its progress.
- 🔁 **Right-click to reset**: Reset the progress to 0 with a right-click.
- 🎨 **Customization**: Customize the color, size, animation, and more.

## 📝 Example Use Cases

Interactive progress bars can be a great visual tool to track daily habits, goals, or any repetitive tasks in your **Obsidian dashboards**. Here are a few ways you can use this plugin:

- **Track your daily water intake**: Like I do! I use this plugin to track how much water I drink each day. Each time I finish a glass, I click the bar, and it increments. It's a great visual reminder to stay hydrated. 💧
  
  _Here’s what it looks like in action:_  
![image](https://github.com/user-attachments/assets/bb4cc07b-0359-4d2a-b698-636cb8a1672d)

With this source code :

```progress-bar
name: BlueWater
initialProgress: 0
total: 3000
color: #0055ff
increment: 50
legend: Water drunk today {current_progress}ml/{total}ml
```

- **Monitor your reading goals**: Keep track of how many chapters or pages you've read in a book or study material. 📚
  
- **Track workout progress**: Whether it's reps, sets, or workout days in a week, visualize your fitness progress with easy-to-update bars. 💪

- **Habit tracking**: Track habits like writing, coding, meditation, or any daily task. With one click, you can update your habit progress and reset it at the start of each day. 🧘‍♂️

- **Project milestones**: Track progress on your coding or personal projects. Set up milestones and watch your progress bar fill up as you hit each step! 🚀

The flexibility of this plugin allows you to easily adjust the bar's settings to match your style, whether for personal dashboards or project notes.

## 🛠️ Installation

To install and try out the **Obsidian Interactive Progress Bar Plugin**, follow these steps:

1. Download `main.js`, `styles.css` and `manifest.json` from the [latest release](https://github.com/mathe00/obsidian-progress-bar-plugin/releases).
2. Create a new folder in your Obsidian vault under the path:  
   `<your-vault>/.obsidian/plugins/interactive-progress-bar-plugin/`
3. Place the downloaded files into this folder.
4. Restart Obsidian.
5. Go to **Settings** > **Community plugins** and enable the **Interactive Progress Bar Plugin**.

That’s it! The plugin should now be active, and you can start using it to add progress bars to your notes.

## 🧑‍💻 Development

The plugin is written in TypeScript with a strict toolchain (ESLint + Prettier + Vitest) and bundled with esbuild.

Prerequisites: [Bun](https://bun.sh).

```bash
bun install        # install dependencies
bun run dev        # watch mode (rebuilds main.js and styles.css on change)
bun run check      # typecheck + lint + format check + tests + production build
```

Individual steps: `bun run typecheck`, `bun run lint`, `bun run format`, `bun run test`.

> The compiled `main.js` is generated locally by the build and is not committed
> to the repository - releases carry the distributable files.

## 🛠️ Contributing

Let’s be honest, **I’m not a JavaScript expert** (nor TypeScript, for that matter 😅), but I’ve done my best to make this plugin functional. **I’m a Python developer**, so I understand what I’m doing to some extent, but JS and TS are different worlds for me. This plugin does what I need, so I don’t plan to take it much further. However, if you want to add features or improve the code, I’d be happy to see contributions!

Oh, and **English isn’t my first language**, so I apologize if I misunderstand something or take a bit longer to respond to issues or pull requests 😅. Thanks for your patience!

Feel free to open issues or pull requests, and I’ll do my best to respond, though **GitHub is still somewhat new to me**.

## ⭐ Show Your Support

I’m not really concerned about the number of stars, but if you find this project useful or interesting, consider giving it a star on GitHub to help me gauge the interest. If you’d rather not leave a star, that’s totally fine – feel free to open an issue, submit a pull request, or even drop a message of support in an issue instead! All kinds of feedback, advice, and contributions are always welcome and appreciated. 😊
