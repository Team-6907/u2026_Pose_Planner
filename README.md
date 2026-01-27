# GOATLIB Pose Planner (2026)

A lightweight, browser-based pose planner for the 2026 FRC field. It renders the AdvantageScope field image and lets you create/edit named poses (x, y, theta) in wall-blue coordinates to match WPILib FieldConstants and AprilTagFieldLayout.

## Live Demo

Visit the hosted version: **https://team-6907.github.io/u2026_Pose_Planner/**

## Run Locally

Under the root directory of the project, run:
```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/` in a browser.

## Coordinate System

- wall-blue (WPILib blue alliance coordinates)
- X increases from the blue wall toward red (field length)
- Y increases to the left from the blue driver station perspective (field width)
- Theta is degrees CCW from +X (WPILib Rotation2d convention)

## Workflow

1. **Import**: Copy your existing `poses.json` content and paste it into the planner (or use file import when implemented)
2. **Edit**: Use the GUI to create, modify, and organize poses visually on the field
3. **Export**: Click "Copy JSON to Clipboard" to copy the updated poses
4. **Deploy**: Paste the JSON into your robot project at `src/main/deploy/goatlib-poses/poses.json`

Groups are stored with `/` hierarchy (for example: Auto/Score).

## JSON Format

```json
{
  "schemaVersion": 1,
  "field": "Field2d_2026FRCFieldV1",
  "units": "meters",
  "thetaUnits": "degrees",
  "groups": [
    {
      "name": "Auto/Score",
      "color": "#4f46e5",
      "poses": [
        { "name": "Start", "x": 1.0, "y": 2.0, "thetaDegrees": 180.0 }
      ]
    }
  ]
}
```

## GitHub Pages Deployment

This project is configured to be hosted on GitHub Pages. To deploy:

1. Push your changes to the `main` branch
2. Go to repository Settings → Pages
3. Set Source to "Deploy from a branch"
4. Select branch: `main`, folder: `/ (root)`
5. Save and wait for deployment

The site will be available at `https://team-6907.github.io/u2026_Pose_Planner/`
