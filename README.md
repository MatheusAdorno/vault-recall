# Vault Recall

Vault Recall is an Obsidian plugin designed for spaced repetition of notes tagged with a specific tag, enabling effective review and retention of information.

## Features

- **Tag-Based Review**: Select a review tag (default: `#review`) to mark notes for spaced repetition.
- **Tag Detection**: Automatically detects tags in inline text and frontmatter.
- **Overview Dashboard**: Displays total tagged notes, notes due today, and notes reviewed today.
- **Review Flow**: Shows the current note, with an `Open Note` button, followed by recall assessment with `Forgot`, `Hard`, `Good`, and `Easy` options.
- **Session Management**: If `Forgot` is selected, the note moves to the end of the current session queue. Sessions persist for the day, maintaining queue and counts when reopening.
- **Dynamic Updates**: UI reflects changes when notes gain or lose the review tag without restarting Obsidian.
- **Next Review Calculation**: Displays the next review date at the end of the session.
- **Compact Vertical Layout**: Optimized for good UX in Obsidian's side panels.

## How it works

Vault Recall implements spaced repetition for your notes:

1. Choose a review tag (e.g., `#review`).
2. The plugin scans your vault for notes with that tag.
3. The overview shows statistics like total tagged notes, due today, and reviewed today.
4. Start a review session: The plugin presents notes one by one.
5. Click `Open Note` to view the full note.
6. After reviewing, rate your recall: `Forgot` (moves to end of queue), `Hard`, `Good`, or `Easy`.
7. The plugin adjusts the next review based on your rating and persists the session for the day.
8. At session end, see the next review date.

## Installation

### From Community Plugins

Vault Recall is available in Obsidian's Community Plugins. Search for "Vault Recall" and install it (available after approval/publication).

### Manual Installation

1. Download the latest release from the [GitHub repository](https://github.com/MatheusAdorno/vault-recall).
2. Extract the files into your Obsidian vault's `.obsidian/plugins/vault-recall/` folder.
3. Reload Obsidian and enable the plugin in Settings > Community Plugins.

## Usage

1. Open the Vault Recall pane in Obsidian's side panel.
2. Configure your review tag in settings if needed.
3. View the overview for statistics.
4. Start reviewing notes using the provided buttons.
5. Rate your recall after each note to adjust future reviews.

## Settings

- **Review Tag**: Set the tag used for marking notes (default: `#review`).

## Repository

The source code is available at [https://github.com/MatheusAdorno/vault-recall](https://github.com/MatheusAdorno/vault-recall).

## Roadmap

- Enhanced customization options for review intervals.
- Integration with additional spaced repetition algorithms.
- Support for custom review templates.

## Support

For issues, feature requests, or contributions, please visit the [GitHub repository](https://github.com/MatheusAdorno/vault-recall) and open an issue or pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/MatheusAdorno/vault-recall/blob/main/LICENSE) file for details.
