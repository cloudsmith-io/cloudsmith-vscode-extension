# Cloudsmith Visual Studio Code Extension

Bringing Cloudsmith to Visual Studio Code! You can now explore your Cloudsmith packages directly within Visual Studio Code. 

![Cloudsmith extension overview](media/readme/overview.gif)

## Installation

To install the extension, open the Extensions view, search for `cloudsmith` to filter results and select the Cloudsmith extension authorised by Cloudsmith. 

To connect to your Cloudsmith isntance, you need to configure either your own Personal API Key or a Service Account Token. 

* Entitlement tokens are not supported. 

* Personal API Keys provide support for accessing mulitple Cloudsmith Workspaces if access is granted. A Service Account Token will provide access to a specific Workspace only. 



## Overview

### Package Explorer

The Cloudsmith extension contributes a Cloudsmith view to VS Code. The Cloudsmith Explorer lets you examine packages stored within your Cloudsmith assets: workspaces, repositories, packages. 

The right-click menu provides access to the following commands for packages:


* List Workspaces, Repositories and Packages. 
* Inspect packages raw json data. 


## Requirements

Configure your Cloudsmith Personal API Key or alternative Access Token.



## Release Notes

### 1.0.0

* The initial release provides a simple package explorer view into your Cloudsmith environments. 
* Future releases will continue to build upon this with futher capabilities and features. 

---

## Design notes

[Use icons from VS Code themes wherever possible](https://code.visualstudio.com/api/references/icons-in-labels).
[Custom icons can be exported from this Figma file](https://www.figma.com/design/S5jrSWCDUGYRWH9tc9pLu9/VS-Code-Extension?node-id=0-1&p=f&t=1w0iWKl1uPmPzM37-11).

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
