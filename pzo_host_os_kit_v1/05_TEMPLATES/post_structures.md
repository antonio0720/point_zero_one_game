# Post Structure Templates

## 12s Post

```md
---
title: "Title (12s Format)"
date: "YYYY-MM-DD"
author: "Author Name"
tags: ["tag1", "tag2"]
image: "/path/to/image.jpg"
description: "Brief description of the post."
---

```

## 25s Post (Story Block)

```md
---
title: "Title (2-minute Format)"
date: "YYYY-MM-DD"
author: "Author Name"
tags: ["tag1", "tag2"]
image: "/path/to/image.jpg"
description: "Brief description of the post."
---

**Story Block:**

```markdown
* Story element 1
* Story element 2
* ...
```

## Collab Stitch Template

```md
---
title: "Title (Collaboration Format)"
date: "YYYY-MM-DD"
author: "Author Name 1, Author Name 2"
tags: ["tag1", "tag2"]
image: "/path/to/image.jpg"
description: "Brief description of the post."
---

**Collaboration:**

```markdown
- Contribution from Author Name 1
- Contribution from Author Name 2
- ...
```

## 45s Post

```md
---
title: "Title (45s Format)"
date: "YYYY-MM-DD"
author: "Author Name"
tags: ["tag1", "tag2"]
image: "/path/to/image.jpg"
description: "Brief description of the post."
---

```

## Weekly Challenge Post Format

```md
---
title: "Title (Weekly Challenge)"
date: "YYYY-MM-DD"
author: "Author Name"
tags: ["weekly challenge"]
image: "/path/to/image.jpg"
description: "Brief description of the post."
---

**Challenge:**

```markdown
- Challenge element 1
- Challenge element 2
- ...
```

### Non-negotiables

- All templates must adhere to strict TypeScript and Markdown syntax.
- Use precise, execution-grade language in all posts.
- Include relevant tags for easy categorization and discovery.
- Ensure images are optimized for fast loading times.
- Provide a clear and concise description for each post.

### Implementation Spec

- Templates should be easily reusable across multiple posts.
- Use consistent formatting and structure for all templates.
- Include necessary metadata (title, date, author, tags, image, description) in the YAML front matter.
- Utilize Markdown syntax for structuring content within each post.

### Edge Cases

- If a post requires additional sections or elements not covered by these templates, create new templates as needed while maintaining consistency with existing ones.
