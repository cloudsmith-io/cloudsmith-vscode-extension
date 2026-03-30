const vscode = require("vscode");

function getPercentValue(displayMetric, rawMetric) {
  if (displayMetric && displayMetric.percentage_used != null) {
    const parsed = parseFloat(displayMetric.percentage_used);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  if (
    rawMetric &&
    typeof rawMetric.used === "number" &&
    typeof rawMetric.plan_limit === "number" &&
    rawMetric.plan_limit > 0
  ) {
    return (rawMetric.used / rawMetric.plan_limit) * 100;
  }

  return null;
}

function getMetric(quotaData, metricName) {
  const usage = quotaData && quotaData.usage ? quotaData.usage : {};
  const displayMetric =
    usage.display && typeof usage.display === "object"
      ? usage.display[metricName]
      : null;
  const rawMetric =
    usage.raw && typeof usage.raw === "object" ? usage.raw[metricName] : null;
  const percentValue = getPercentValue(displayMetric, rawMetric);

  return {
    used:
      displayMetric && displayMetric.used != null
        ? String(displayMetric.used)
        : rawMetric && rawMetric.used != null
          ? String(rawMetric.used)
          : "Not available",
    planLimit:
      displayMetric && displayMetric.plan_limit != null
        ? String(displayMetric.plan_limit)
        : rawMetric && rawMetric.plan_limit != null
          ? String(rawMetric.plan_limit)
          : "Not available",
    percentValue: percentValue,
    percentLabel:
      percentValue !== null ? `${Math.round(percentValue)}%` : "Not available",
  };
}

function getUsageIcon(iconName, percentValue) {
  if (percentValue !== null && percentValue >= 90) {
    return new vscode.ThemeIcon(
      iconName,
      new vscode.ThemeColor("errorForeground")
    );
  }

  if (percentValue !== null && percentValue >= 75) {
    return new vscode.ThemeIcon(
      iconName,
      new vscode.ThemeColor("editorWarning.foreground")
    );
  }

  return new vscode.ThemeIcon(iconName);
}

function getSummaryPercentValue(storage, bandwidth) {
  const values = [storage.percentValue, bandwidth.percentValue].filter(
    value => value !== null
  );

  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

function getCompactDescription(quotaData, storage, bandwidth) {
  if (!quotaData) {
    return "Quota unavailable";
  }

  return `Storage: ${storage.percentLabel} | Bandwidth: ${bandwidth.percentLabel}`;
}

class WorkspaceInfoNode {
  constructor(workspaceName, quotaData) {
    this.workspaceName = workspaceName;
    this.quotaData = quotaData;
  }

  getTreeItem() {
    const storage = getMetric(this.quotaData, "storage");
    const bandwidth = getMetric(this.quotaData, "bandwidth");
    const summaryPercentValue = getSummaryPercentValue(storage, bandwidth);
    const iconPath = this.quotaData
      ? getUsageIcon("graph", summaryPercentValue)
      : new vscode.ThemeIcon("lock");

    return {
      label: `Workspace: ${this.workspaceName}`,
      description: getCompactDescription(this.quotaData, storage, bandwidth),
      tooltip: this._buildTooltip(storage, bandwidth),
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
      contextValue: "workspaceInfo",
      iconPath: iconPath,
    };
  }

  getChildren() {
    if (!this.quotaData) {
      return [
        new WorkspaceDetailNode(
          "Quota unavailable",
          "Additional permissions may be required.",
          new vscode.ThemeIcon("lock")
        ),
      ];
    }

    const storage = getMetric(this.quotaData, "storage");
    const bandwidth = getMetric(this.quotaData, "bandwidth");

    return [
      new WorkspaceDetailNode(
        "Storage",
        `${storage.used} / ${storage.planLimit} (${storage.percentLabel})`,
        getUsageIcon("database", storage.percentValue)
      ),
      new WorkspaceDetailNode(
        "Bandwidth",
        `${bandwidth.used} / ${bandwidth.planLimit} (${bandwidth.percentLabel})`,
        getUsageIcon("pulse", bandwidth.percentValue)
      ),
    ];
  }

  _buildTooltip(storage, bandwidth) {
    if (!this.quotaData) {
      return `Workspace quota for ${this.workspaceName}\n\nQuota information is not available. This may require additional permissions.`;
    }

    const lines = [`Workspace quota for ${this.workspaceName}`];
    lines.push(`Storage: ${storage.used} / ${storage.planLimit} (${storage.percentLabel})`);
    lines.push(
      `Bandwidth: ${bandwidth.used} / ${bandwidth.planLimit} (${bandwidth.percentLabel})`
    );
    return lines.join("\n");
  }
}

class WorkspaceDetailNode {
  constructor(label, value, icon) {
    this.label = label;
    this.value = value || "";
    this.icon = icon;
  }

  getTreeItem() {
    return {
      label: this.label,
      description: this.value,
      tooltip: this.value ? `${this.label}: ${this.value}` : this.label,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: "workspaceDetail",
      iconPath: this.icon,
    };
  }

  getChildren() {
    return [];
  }
}

module.exports = { WorkspaceInfoNode, WorkspaceDetailNode };
