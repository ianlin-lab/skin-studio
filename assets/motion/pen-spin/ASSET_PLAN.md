# Renaissance Pen Spin

## Source master

- `renaissance-pen-spin-master.png`
- 1586 × 992 PNG, RGB
- SHA-256: `66d2054038b40ad456b1fa99c1bcf52adf0b0caf2647e7398d1509ef5a997da3`
- Preserve this file unchanged. All generated and edited assets must be derived copies.

## Target animation

- Freeze the full composition, including the head, body, clothes, curtain, clouds,
  desk, monitor, board, and camera.
- Animate only the pencil and the smallest necessary finger occlusion around the
  right hand.
- Use a seamless 2.0–2.4 second loop at 18–20 fps.
- Avoid camera motion, breathing motion, cloth motion, global parallax, relighting,
  morphing, or generative texture drift.

## Production outputs

1. `renaissance-static-16x10.png`
   - Static clean base, cropped to exact 16:10.
   - Pencil removed only where required for the animation clean plate.
2. `pen-spin-overlay.webp`
   - Small transparent animated overlay containing the pencil, local shadow, and
     minimal foreground finger masks.
   - Preferred long-term Skin Studio asset because it is deterministic and compact.
3. `renaissance-pen-spin-full.webp`
   - Full-frame animated WebP composited from the static base and overlay.
   - Compatibility build for the current single-background Skin Studio format.
4. `poster.png`
   - Static fallback / preview thumbnail.

## Recommended workflow

1. Make one precise clean-plate edit around the pencil, leaving the rest untouched.
2. Reconstruct the pencil as a separate high-resolution layer.
3. Build a small set of controlled spin key poses and finger occlusion masks.
4. Interpolate the motion deterministically and composite locally.
5. Export and visually compare the first and last frames to verify a seamless loop.
6. Validate the full-frame WebP in Skin Studio before extending the theme format to
   support the compact overlay asset.

Direct full-image AI video generation is useful only as a motion reference. It is
not the production path because it can introduce hand, fabric, lighting, and texture
drift outside the intended animation region.

## Produced variants

- `renaissance-living-parallax-v3.svg`
  - No pencil or hand animation.
  - Separates the clouds, monitor/board, two curtain planes, and the complete
    figure into distinct motion layers, with visibly different depth shifts.
  - The figure uses a 6.3-second inhale/exhale and whole-body parallax rather
    than only a local shoulder movement.
- `preview-v3.html`
  - Exercises the SVG through the same CSS-background path used by Skin Studio.
