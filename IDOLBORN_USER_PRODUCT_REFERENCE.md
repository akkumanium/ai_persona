# Idolborn: User Product Reference

## What Idolborn is

Idolborn is one workspace for creating and running an AI creator persona. A persona is the reusable identity behind your content: its name, look, reference images, style direction, images, videos, voice clips, and talking-avatar content.

The product is designed for creators, social-media operators, and small teams who want to make a large amount of content around a recognisable virtual person. Its main promise is continuity: instead of starting over for every post, you define a persona once and use its saved references whenever you make new content.

This document describes the current product from a user’s point of view. It is intended as a source for future help articles, onboarding material, and customer-facing guides.

## The main value to a user

- Keep a persona’s face, body, and general style more consistent across images and videos.
- Create images, short videos, voice lines, and talking-avatar clips without moving between separate services.
- Save references and finished work in one personal library.
- Choose the level of quality, shape, length, and creative control appropriate to a particular post or campaign.
- See the token cost before submitting a generation.
- Work from a source video to recreate its movement with the chosen persona.
- Access practical written guides about persona strategy, account setup, audience quality, and platform-aware content planning.

## Who it is for

Idolborn is best suited to people who want to build a repeatable content workflow around one or more virtual creators. Typical uses include:

- Building a social-media persona with a recognisable identity.
- Making a supply of feed images, portraits, campaign visuals, and vertical clips.
- Turning an existing still image into a short video.
- Giving a persona spoken dialogue and creating a video of it speaking.
- Adapting a trend or reference reel while keeping the creator persona visible.
- Managing several distinct personas for different accounts, clients, or content directions.

## The overall user journey

1. Create an account and choose a subscription plan.
2. Create a persona with a name and short description.
3. Build its reference set by uploading images or generating new reference images.
4. Mark the strongest reference as the default, so it is easy to reuse.
5. Generate images that use the persona’s saved identity.
6. Turn a selected image into a normal video, a motion-controlled video, or a talking avatar.
7. Store, review, open, and remove work in the asset library; check activity and spending in Jobs and Settings.

The workflow is flexible. A user can upload their own reference material, generate a persona from a written prompt, or blend several face images into a new identity before making content.

## Personas

The Personas area is the foundation of the workspace.

### Creating and managing a persona

Each persona has a name and description, and can later be edited to add style notes. The description and style direction help keep future creative requests aligned with the intended character. A persona card shows its current status and the number of associated assets.

Users can open a persona to:

- Edit its name, description, and style direction.
- Add, preview, and remove reference images.
- Generate more references.
- See the persona’s images and videos in context.
- Delete the persona when it is no longer needed.

Deleting a persona removes the persona profile. Users should review and separately manage any work they want to keep, since previously created assets can remain in the wider asset library.

### Reference sets

References are the visual source of truth for a persona. They make it easier to keep the same person recognisable from one generation to the next.

Idolborn organises references into four useful categories:

- **Face** — a clear identity reference.
- **Chest-up** — a portrait that includes the face, shoulders, and upper body.
- **Body** — a wider reference for body shape, pose, and proportions.
- **Face Grid** — multiple expressions and viewing angles in one sheet.

For every category, a user may upload an image or generate a new one. More than one reference can be kept. The preferred image can be marked as the default reference, making it the natural starting point for later work.

### Ways to create a face reference

There are two face-creation paths:

- **Generate from a description** — describe the intended identity and, where useful, add optional image inputs for inspiration or guidance.
- **Blend faces** — provide two or more face images to create a single, cohesive identity.

When creating identity references, the product asks the user to confirm that they have the right to use the supplied images and that the persona is an adult. These confirmations are an important part of using the feature responsibly.

## Image creation

The Images area creates still images for the selected persona. Users write a prompt describing the scene, outfit, pose, mood, location, or campaign idea, then choose the persona references that should guide the result. They can also add extra image references for a specific visual direction.

The workspace supports both reference-led images and prompt-led images. Reference-led work is particularly useful when identity consistency matters; prompt-led work is useful when starting a new concept.

Users can choose:

- The image engine that best fits the task.
- Portrait, square, landscape, wide, or vertical framing, depending on the engine.
- Output size, including options from 1K to 4K where available.
- A quality level for the image engine that offers it.
- Saved persona references and additional uploaded references.

The available image models are Nano Banana Pro, ChatGPT Image 2, Seedream 4.5, and Wan 2.7 Image. All are provided through WaveSpeed and have different framing, size, and quality choices, so the interface only shows settings that are meaningful for the selected option.

The product includes prompt suggestions for inspiration. Finished images are saved as persona assets. From an image result, a user can move directly into video, motion-control, or talking-avatar creation.

## Video creation

The Videos area creates short clips from a prompt and, for image-to-video options, a selected or uploaded starting image. It is suited to social posts, short product or lifestyle clips, and expressive persona moments.

Depending on the chosen video option, a user can control:

- A written description of the action or scene.
- The starting image, selected from the persona’s existing images or uploaded directly.
- An optional ending image when supported, to guide the final moment of the clip.
- Vertical, square, or landscape framing.
- Clip length.
- Output resolution.
- An optional negative prompt: a short list of things the user wants the result to avoid.
- Sound generation where the chosen option supports it.
- The option to return the final frame for reuse in follow-up content.

Some video choices also accept reference video and audio inputs. This provides extra creative guidance when the user wants the clip’s pacing, movement, or sound direction to follow existing material.

The current video choices include WaveSpeed-hosted Wan 2.7, several Kling 2.6 and Kling 3.0 options, and Seedance 2.0, including a faster Seedance version. The product presents these as creative choices with different controls, duration ranges, quality levels, and price points.

## Motion Control

Motion Control is for transferring movement to a persona image. A user supplies a character image and a driving video, then generates a new video that follows the source movement while using the selected persona.

This is especially useful for recreating a gesture, camera-friendly movement, or short performance without manually describing every movement in a prompt.

Available controls vary by the selected option, but can include:

- A movement description.
- A driving video.
- A choice between animating the image or replacing the source character.
- Whether the character should follow the orientation in the image or the source video.
- Keeping the original sound from the driving video.
- A negative prompt to reduce unwanted visual issues.
- 480p or 720p output, depending on the choice.

The WaveSpeed-hosted motion-control choices include Wan Animate and Kling 3.0 Motion. The selected option determines which of the above controls are available.

## Reel Maker

Reel Maker is a guided workflow for turning an uploaded source reel into a reel featuring the chosen persona.

### How it works

1. Upload or drag in a source video.
2. Idolborn captures the first frame and shows it in a reusable library.
3. Use the **Face Swap** step to create one to four candidate versions of that frame with the persona’s identity.
4. Choose the strongest candidate.
5. Use the **Motion** step to generate a new reel that follows the movement of the source video.

The source reels, candidate images, and completed reels can be revisited from the Reel Maker library. This makes it practical to compare candidates and refine a concept instead of losing the work after one attempt.

## Speech

The Speech area turns written text into reusable audio for a selected persona. It can be used for voice lines, narration, dialogue, and audio preparation for a talking avatar.

Users can choose a preset voice or provide an approved voice ID, then adjust:

- The spoken text.
- Output format.
- Stability of the delivery.
- Similarity to the selected voice.
- Expressive style.
- Speaking speed.

The current built-in preset is Brielle, described as a Gen Z podcast-style voice. Generated audio is saved in the asset library and can be played, reused, or deleted.

## Talking Avatar

Talking Avatar combines a portrait image with an audio file to create a video of the persona speaking. It is a natural next step after making a speech clip, though users can also upload their own audio.

To create one, a user chooses or uploads:

- A portrait image.
- A saved speech asset or an audio file.
- A talking-avatar option.
- A resolution of 480p or 720p.
- An optional prompt describing the desired delivery, such as a natural talking head, a subtle expression, or a steady camera.

The video automatically matches the length of the chosen audio. The available talking-avatar options are Longcat Avatar and InfiniteTalk.

## Assets and activity history

### Asset library

The Assets area is the central place for finished and uploaded material. It can be filtered to show:

- All assets.
- Generated persona references.
- Uploaded source material.
- Images.
- Videos.
- Audio.

Users can preview or play an item, open it in a separate tab, see its persona and prompt information, and remove it when it is no longer useful. This keeps reusable material close at hand for later projects.

### Jobs

Jobs is an activity history for creation requests. For each job, the user can see what was created, its status, when it was started, the prompt, and the token cost. This helps users understand which work is in progress, which has finished, and how they have used their balance.

## Plans, tokens, and billing

### Preview and paid use

After signing in, users can browse the Studio in preview mode. An active subscription is required to generate content and use paid workspace capacity. Every subscription includes a one-time welcome credit of 300 tokens.

### Subscription plans

| Plan | Price | Persona capacity | Welcome credit |
| --- | ---: | --- | --- |
| Monthly | $12 monthly | Unlimited personas | 300 tokens, once |
| Yearly | $80 yearly | Unlimited personas | 300 tokens, once |

Both plans can be cancelled at any time.

### Token balance and top-ups

Generations are paid for with tokens. The Studio displays the estimated token cost before a request is submitted, so users can make an informed choice before they spend.

Active subscribers can add tokens in these amounts:

| Top-up | Tokens |
| --- | ---: |
| $2 | 200 |
| $5 | 500 |
| $10 | 1,000 |
| $20 | 2,000 |
| $50 | 5,000 |
| $100 | 10,000 |

Top-ups are available only to users with an active subscription.

### Managing membership and refunds

Users can open a secure billing area from Settings or the pricing page to update or cancel a membership. Cancelling stops future renewals.

The current refund flow allows a full refund of the latest subscription payment only if none of the credits from that payment have been used. The interface checks eligibility before a refund request is made; an approved refund removes the related subscription credits.

## Referrals

Every signed-in user can copy a personal referral link from Settings. When someone subscribes through that link, the referrer receives 100 tokens. Settings also shows pending referrals, rewarded referrals, and the total earned amount.

## Account access and support

### Signing in

Users can create an account or sign in with email and password, or continue with Google. Account sign-in keeps personas, prompts, generated media, and token balance connected to the user’s workspace.

### Guides and community

The public Guides area currently includes articles about:

- Essential tools and account setup.
- Choosing a model concept that is distinctive without relying on extreme novelty.
- Improving the chance of reaching a high-value US and other English-speaking audience.

The site also links to a Telegram community. Guides are designed to be updated as practical advice and platform conditions change.

### Contact

Users can contact Idolborn through the Contact page to report bugs, mistakes, or suggestions. The page provides email, a Telegram support contact, and a public Telegram group.

## Important responsible-use notes

- Only upload or use identities, voices, images, audio, and videos that the user has permission to use.
- Persona-reference creation requires confirmation of rights to the identity material and confirmation that the persona is an adult.
- An uploaded or generated item may be used again as a creative reference, so users should consider carefully what they save to their workspace.
- Creative output can vary. References, clear prompts, and selecting the best candidate are the main tools users have to improve consistency.
- Exact controls, timing, output quality, and token cost vary by the selected image, video, motion, speech, or avatar option.

## What information the product uses during a creation workflow

In straightforward terms, Idolborn needs the information required to save work and create it: account details, persona descriptions, prompts, chosen settings, uploaded media, generated media, and token/billing information. When a user asks for a generation, the necessary prompt and selected media are sent to the relevant creative service to produce the result.

Users should therefore treat uploaded media and prompts as meaningful workspace content, use only material they are authorised to share, and avoid including sensitive information that is not needed for the creation task.

## Summary of the product’s differentiators

Idolborn is not positioned as a general one-off image generator. Its distinguishing user benefit is the connected persona workflow:

- One saved identity can guide references, images, videos, voice, and talking-avatar output.
- The workspace brings creation, assets, spending visibility, and billing together.
- Users can start with their own material, generate a new identity, or blend several face images.
- Reel Maker and Motion Control support content that follows a reference video’s movement.
- The platform includes practical education alongside the production tools.
- Both subscriptions include an unlimited persona portfolio, with token top-ups for continued generation.

