create table if not exists public.guide_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  eyebrow text not null default '',
  summary text not null default '',
  body text not null default '',
  published boolean not null default true,
  author_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guide_articles enable row level security;

drop policy if exists "published guide articles are public" on public.guide_articles;
create policy "published guide articles are public" on public.guide_articles
  for select using (published = true);

drop policy if exists "guide admin can read all articles" on public.guide_articles;
create policy "guide admin can read all articles" on public.guide_articles
  for select using (
    auth.uid() = 'c6f4fe0c-16ee-489e-9734-da2492f9a502'::uuid
    or lower(auth.jwt() ->> 'email') = 'imblueop@gmail.com'
  );

drop policy if exists "guide admin can insert articles" on public.guide_articles;
create policy "guide admin can insert articles" on public.guide_articles
  for insert with check (
    auth.uid() = 'c6f4fe0c-16ee-489e-9734-da2492f9a502'::uuid
    or lower(auth.jwt() ->> 'email') = 'imblueop@gmail.com'
  );

drop policy if exists "guide admin can update articles" on public.guide_articles;
create policy "guide admin can update articles" on public.guide_articles
  for update using (
    auth.uid() = 'c6f4fe0c-16ee-489e-9734-da2492f9a502'::uuid
    or lower(auth.jwt() ->> 'email') = 'imblueop@gmail.com'
  )
  with check (
    auth.uid() = 'c6f4fe0c-16ee-489e-9734-da2492f9a502'::uuid
    or lower(auth.jwt() ->> 'email') = 'imblueop@gmail.com'
  );

grant select on table public.guide_articles to anon, authenticated, service_role;
grant insert, update, delete on table public.guide_articles to authenticated, service_role;

insert into public.guide_articles (slug, title, eyebrow, summary, body, published)
values
  (
    'essential-tools-and-setup',
    'Essential Tools and Setup',
    'Account foundation',
    'The practical setup basics: device choice, SIM usage, trust score, Wi-Fi, VPNs, proxies, and account consistency.',
    $md$
## Hardware Requirements

**Get a Separate Phone**: Do not use your personal device. I recommend an iPhone 11 or higher because iPhones tend to have higher trust signals with social platforms and help you avoid the cheap-device phone farm pattern.

**Condition does not matter much**: A cracked screen or non-working camera is not a problem if the device is only used for uploads and account management.

**Get a Local SIM Card**: Any cheap SIM can work. Use it exclusively for mobile data and keep the account activity tied to one consistent device and network pattern.

## Understanding Trust Score

Social platforms assign each account a hidden trust score based on how legitimate the account looks. Low trust scores can reduce overall reach and lower the quality of the demographics you reach.

- Consistency of login location
- Device consistency
- Posting patterns
- IP address stability

## Critical Don'ts

**Do not use Wi-Fi**: Use mobile data such as 4G or 5G for the account instead of jumping between home, cafe, hotel, or public Wi-Fi networks.

**Do not use VPNs**: VPNs usually do not decide which audience you reach. They often route through shared IPs that platforms can flag as suspicious.

**Do not post from multiple locations**: Posting from different countries while traveling can damage reach until the account returns to its usual home-country pattern.

## Should You Use a Proxy?

This is a controversial point. From the data we have, a proxy is not the deciding factor in reaching a US audience or avoiding bans. Accounts located in Europe and Asia have still reached US audiences without issue.

If you decide to use a proxy, create the account while using it and continue using the same IP pattern. The goal is consistency, not constant switching.

Proxy services mentioned: Dataimpulse, Gridpanel, Marsproxy, Proxyline, Bytepass, and IPRoyal.
$md$,
    true
  ),
  (
    'what-your-model-should-look-like',
    'What Your Model Should Look Like',
    'Persona strategy',
    'A straightforward guide to choosing a model concept that can convert instead of chasing novelty that burns out quickly.',
    $md$
## What Not To Do

Extreme novelty can attract views, but it often attracts the wrong kind of attention and weakens conversion.

- Two-headed AI influencers
- Four-handed models
- 50% black / 50% white split characters
- Models with extreme physical anomalies

## Why Avoid Extreme Concepts?

- Many platforms prohibit them outright, including Fanvue.
- They usually produce poor conversion rates despite high views.
- They have a short shelf life once the novelty wears off.
- They attract curiosity seekers instead of paying customers.

## What Actually Works

**Option 1: Basic Hot Girl**: Simple, straightforward, and extremely effective when the branding is clear. This has broad appeal and a lower barrier to entry.

**Option 2: Unique Hot Girl**: Add one memorable detail: unusual hair, unique makeup, distinctive accessories, or a recognizable styling cue. The goal is distinct without becoming extreme.

## Unique Elements That Work

- Eyebrow slits
- Distinctive hair clips
- Unique colored highlights
- Unusual accessories
$md$,
    true
  ),
  (
    'how-to-get-us-audience',
    'How to Get 90%+ US Audience',
    'Traffic quality',
    'A tactical overview of why audience quality matters and how language, visual context, symbols, and audio influence who sees your content.',
    $md$
## Why Do We Even Need a US Audience?

If you are running an OFM business, your goal is not just to get views. The goal is to make money from people who actually spend.

The US, UK, Canada, and Western Europe make up a smaller share of social media users, but they generate a much larger share of paid creator revenue.

Countries with very large populations can still spend far less per person on paid creator platforms than the US market does.

## The Bottom Line

**Tier 1 audiences**: US, UK, Canada, and Western Europe audiences tend to have higher disposable income, greater willingness to spend, and better average lifetime value.

**Tier 3 audiences**: Latin America, India, North Africa, and similar markets usually have lower purchasing power, lower conversion rates, and higher operational cost per dollar earned.

The math is simple: better audience quality creates a better business.

## Tactical Solutions for Tier 1 Audiences

Meta uses computer vision to analyze content frame by frame. It identifies objects, text, scenery, and audio elements, then uses those signals to categorize content and decide who should receive it.

## Bucket 1: Sophistication

Create content that requires a certain level of language and cultural understanding. The easiest filter is English-first content that relies on jokes, captions, and suggestive hints English speakers understand.

Add captions to every video. Computer vision can recognize English text and use it as a signal for English-speaking audiences.

- Avoid hypersexual content because it requires no language comprehension and can pull the wrong demographics.
- Avoid thirst traps, flash trends, and plain dances because they can increase ban risk and weaken long-term value.
- Think quality over quantity. A smaller audience from the right market can outperform a massive audience from the wrong market.

## Bucket 2: Signs, Symbols, and Cultural Context

Computer vision recognizes more than text. It can identify symbols, logos, products, landmarks, scenery, and cultural markers.

- Use American-looking locations. In prompts, include the word American when describing the location.
- Use geotagging where it fits the content strategy.
- Include local landmarks or recognizable regional context.

## Bucket 3: Audio

Music and sound choices significantly affect who you reach. Before using trending audio, think about where that audio is popular and which audience it may pull in.

For example, repeatedly using a Bollywood song can attract viewers from that demographic. Using Bad Bunny can attract Latin American viewers unless that is the audience you intend to reach.

## Key Principles for Success

- Prioritize audience quality over quantity.
- Think in terms of purchasing power, not raw views.
- Create barriers to entry through language and cultural context.
- Use language, text, regional symbols, products, and audio intentionally.
- Do not fear reduced reach when the audience quality improves.
$md$,
    true
  )
on conflict (slug) do nothing;
