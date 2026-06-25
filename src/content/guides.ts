export type GuideSection = {
  title: string;
  intro?: string;
  paragraphs?: string[];
  bullets?: Array<{
    title?: string;
    text: string;
  }>;
  closing?: string;
};

export type Guide = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  sections: GuideSection[];
};

export const guides: Guide[] = [
  {
    slug: "essential-tools-and-setup",
    title: "Essential Tools and Setup",
    eyebrow: "Account foundation",
    summary:
      "The practical setup basics: device choice, SIM usage, trust score, Wi-Fi, VPNs, proxies, and account consistency.",
    sections: [
      {
        title: "Hardware Requirements",
        bullets: [
          {
            title: "Get a Separate Phone",
            text:
              "Do not use your personal device. I recommend an iPhone 11 or higher because iPhones tend to have higher trust signals with social platforms and help you avoid the cheap-device phone farm pattern.",
          },
          {
            title: "Condition does not matter much",
            text:
              "A cracked screen or non-working camera is not a problem if the device is only used for uploads and account management.",
          },
          {
            title: "Get a Local SIM Card",
            text:
              "Any cheap SIM can work. Use it exclusively for mobile data and keep the account activity tied to one consistent device and network pattern.",
          },
        ],
      },
      {
        title: "Understanding Trust Score",
        intro:
          "Social platforms assign each account a hidden trust score based on how legitimate the account looks. Low trust scores can reduce overall reach and lower the quality of the demographics you reach.",
        bullets: [
          { text: "Consistency of login location" },
          { text: "Device consistency" },
          { text: "Posting patterns" },
          { text: "IP address stability" },
        ],
      },
      {
        title: "Critical Don'ts",
        bullets: [
          {
            title: "Do not use Wi-Fi",
            text:
              "Use mobile data such as 4G or 5G for the account instead of jumping between home, cafe, hotel, or public Wi-Fi networks.",
          },
          {
            title: "Do not use VPNs",
            text:
              "VPNs usually do not decide which audience you reach. They often route through shared IPs that platforms can flag as suspicious.",
          },
          {
            title: "Do not post from multiple locations",
            text:
              "Posting from different countries while traveling can damage reach until the account returns to its usual home-country pattern.",
          },
        ],
      },
      {
        title: "Should You Use a Proxy?",
        paragraphs: [
          "This is a controversial point. From the data we have, a proxy is not the deciding factor in reaching a US audience or avoiding bans. Accounts located in Europe and Asia have still reached US audiences without issue.",
          "If you decide to use a proxy, create the account while using it and continue using the same IP pattern. The goal is consistency, not constant switching.",
        ],
        closing:
          "Proxy services mentioned: Dataimpulse, Gridpanel, Marsproxy, Proxyline, Bytepass, and IPRoyal.",
      },
    ],
  },
  {
    slug: "what-your-model-should-look-like",
    title: "What Your Model Should Look Like",
    eyebrow: "Persona strategy",
    summary:
      "A straightforward guide to choosing a model concept that can convert instead of chasing novelty that burns out quickly.",
    sections: [
      {
        title: "What Not To Do",
        intro:
          "Extreme novelty can attract views, but it often attracts the wrong kind of attention and weakens conversion.",
        bullets: [
          { text: "Two-headed AI influencers" },
          { text: "Four-handed models" },
          { text: "50% black / 50% white split characters" },
          { text: "Models with extreme physical anomalies" },
        ],
      },
      {
        title: "Why Avoid Extreme Concepts?",
        bullets: [
          { text: "Many platforms prohibit them outright, including Fanvue." },
          { text: "They usually produce poor conversion rates despite high views." },
          { text: "They have a short shelf life once the novelty wears off." },
          { text: "They attract curiosity seekers instead of paying customers." },
        ],
      },
      {
        title: "What Actually Works",
        bullets: [
          {
            title: "Option 1: Basic Hot Girl",
            text:
              "Simple, straightforward, and extremely effective when the branding is clear. This has broad appeal and a lower barrier to entry.",
          },
          {
            title: "Option 2: Unique Hot Girl",
            text:
              "Add one memorable detail: unusual hair, unique makeup, distinctive accessories, or a recognizable styling cue. The goal is distinct without becoming extreme.",
          },
        ],
      },
      {
        title: "Unique Elements That Work",
        bullets: [
          { text: "Eyebrow slits" },
          { text: "Distinctive hair clips" },
          { text: "Unique colored highlights" },
          { text: "Unusual accessories" },
        ],
      },
    ],
  },
  {
    slug: "how-to-get-us-audience",
    title: "How to Get 90%+ US Audience",
    eyebrow: "Traffic quality",
    summary:
      "A tactical overview of why audience quality matters and how language, visual context, symbols, and audio influence who sees your content.",
    sections: [
      {
        title: "Why Do We Even Need a US Audience?",
        paragraphs: [
          "If you are running an OFM business, your goal is not just to get views. The goal is to make money from people who actually spend.",
          "The US, UK, Canada, and Western Europe make up a smaller share of social media users, but they generate a much larger share of paid creator revenue.",
          "Countries with very large populations can still spend far less per person on paid creator platforms than the US market does.",
        ],
      },
      {
        title: "The Bottom Line",
        bullets: [
          {
            title: "Tier 1 audiences",
            text:
              "US, UK, Canada, and Western Europe audiences tend to have higher disposable income, greater willingness to spend, and better average lifetime value.",
          },
          {
            title: "Tier 3 audiences",
            text:
              "Latin America, India, North Africa, and similar markets usually have lower purchasing power, lower conversion rates, and higher operational cost per dollar earned.",
          },
        ],
        closing:
          "The math is simple: better audience quality creates a better business.",
      },
      {
        title: "Tactical Solutions for Tier 1 Audiences",
        intro:
          "Meta uses computer vision to analyze content frame by frame. It identifies objects, text, scenery, and audio elements, then uses those signals to categorize content and decide who should receive it.",
      },
      {
        title: "Bucket 1: Sophistication",
        paragraphs: [
          "Create content that requires a certain level of language and cultural understanding. The easiest filter is English-first content that relies on jokes, captions, and suggestive hints English speakers understand.",
          "Add captions to every video. Computer vision can recognize English text and use it as a signal for English-speaking audiences.",
        ],
        bullets: [
          {
            title: "Avoid hypersexual content",
            text:
              "This is the single biggest cause of negative demographic drift because it requires no language comprehension and appeals to everyone, including the audiences you are trying not to optimize for.",
          },
          {
            title: "Avoid thirst traps, flash trends, and plain dances",
            text:
              "They can produce short-term spikes, but they increase ban risk, attract low-value audiences, and damage long-term lifetime value.",
          },
          {
            title: "Think quality over quantity",
            text:
              "A smaller audience from the right market can outperform a massive audience from the wrong market. Do not fear reduced reach; fear poor demographics.",
          },
        ],
      },
      {
        title: "Bucket 2: Signs, Symbols, and Cultural Context",
        intro:
          "Computer vision recognizes more than text. It can identify symbols, logos, products, landmarks, scenery, and cultural markers.",
        bullets: [
          {
            text:
              "Use American-looking locations. In prompts, include the word American when describing the location.",
          },
          { text: "Use geotagging where it fits the content strategy." },
          { text: "Include local landmarks or recognizable regional context." },
        ],
      },
      {
        title: "Bucket 3: Audio",
        paragraphs: [
          "Music and sound choices significantly affect who you reach. Before using trending audio, think about where that audio is popular and which audience it may pull in.",
          "For example, repeatedly using a Bollywood song can attract viewers from that demographic. Using Bad Bunny can attract Latin American viewers unless that is the audience you intend to reach.",
        ],
      },
      {
        title: "Key Principles for Success",
        bullets: [
          { text: "Prioritize audience quality over quantity." },
          { text: "Think in terms of purchasing power, not raw views." },
          { text: "Create barriers to entry through language and cultural context." },
          { text: "Use language, text, regional symbols, products, and audio intentionally." },
          { text: "Do not fear reduced reach when the audience quality improves." },
        ],
      },
    ],
  },
];
