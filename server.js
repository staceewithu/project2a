// Express is a framework for building APIs and web apps
// See also: https://expressjs.com/
import express from 'express'
// import session from 'express-session'
import { PrismaClient } from '@prisma/client'
import pkg from 'express-openid-connect';
const { auth, requiresAuth } = pkg;

const SCHEMA = "https";
const HOST = 'project2a.vercel.app';
const URL = `${SCHEMA}://${HOST}`;

const config = {
    authRequired: false,
    auth0Logout: true,
    secret: 'ejUegog3QZso_nxxT7FJnnR6vlS4mnsp-RA_v0i6L1vHTzNyd_qukUjv9gMlO0OG',
    baseURL: URL,
    clientID: 'nCwXGTvKX1fOMf3OpXTXjnt3Z2RIqp9C',
    issuerBaseURL: 'https://dev-5wnlxrykvi2z71cj.us.auth0.com',
    routes: {
        login: false,
    }
};



// Initialize Express app
const app = express()
const prisma = new PrismaClient()

// Serve static files from /public folder (useful when running Node locally, optional on Vercel).
app.use(express.static('public'))
// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

// Define index.html as the root explicitly (useful on Vercel, optional when running Node locally).
app.get('/', (req, res) => { res.redirect('/index.html') })
app.get('/login', (req, res) => {
    if (req.oidc.isAuthenticated()) {
        return res.redirect('/index.html');
    }
    res.oidc.login({
        returnTo: '/login/callback',
        authorizationParams: {
            redirect_uri: `${URL}/callback`,
        },
    });
});

app.get('/login/callback', requiresAuth(), async (req, res) => {
    try {
        let user = await prisma.user.findUnique({
            where: { email: req.oidc.user.email }
        });
        if (!user) {
            // Create user if not exists
            user = await prisma.user.create({
                data: {
                    email: req.oidc.user.email,
                    nickname: req.oidc.user.nickname,
                }
            });

        }
    } catch (err) {
        console.error('Login callback error:', err);
        return res.status(500).send('Internal Server Error');
    }

    res.redirect('/index.html');
});

// Enable express to parse JSON data
app.use(express.json())

// ---- Session 配置（用于登录状态） ----
// app.use(session({
//   secret: '7335f0ed991afff1b021beb24346b7a68b580d5a7a52a97456816015e7d6c5f9', // TODO: 换成你自己的随机字符串
//   resave: false,
//   saveUninitialized: false
// }))


// ---- Auth 路由：注册 / 登录 / 登出 / 当前用户 ----

// 注册：email + password + nickname
// app.post('/register', async (req, res) => {
//   const { email, password, nickname } = req.body

//   if (!email || !password || !nickname) {
//     return res.status(400).json({ ok: false, error: 'Missing email, password or nickname.' })
//   }

//   try {
//     const hashed = await bcrypt.hash(password, 10)

//     const user = await prisma.user.create({
//       data: {
//         email,
//         password: hashed,
//         nickname
//       }
//     })

//     // 注册成功后自动登录
//     req.session.userId = user.id
//     req.session.nickname = user.nickname

//     res.json({
//       ok: true,
//       user: { id: user.id, nickname: user.nickname, email: user.email }
//     })
//   } catch (err) {
//     console.error('Register error:', err)
//     res.status(400).json({ ok: false, error: 'Register failed. Maybe this email is already used.' })
//   }
// })

// 登录：email + password
// app.post('/login', async (req, res) => {
//   const { email, password } = req.body

//   if (!email || !password) {
//     return res.status(400).json({ ok: false, error: 'Missing email or password.' })
//   }

//   try {
//     const user = await prisma.user.findUnique({ where: { email } })
//     if (!user) {
//       return res.status(400).json({ ok: false, error: 'User not found.' })
//     }

//     const match = await bcrypt.compare(password, user.password)
//     if (!match) {
//       return res.status(400).json({ ok: false, error: 'Wrong password.' })
//     }

//     req.session.userId = user.id
//     req.session.nickname = user.nickname

//     res.json({
//       ok: true,
//       user: { id: user.id, nickname: user.nickname, email: user.email }
//     })
//   } catch (err) {
//     console.error('Login error:', err)
//     res.status(500).json({ ok: false, error: 'Login failed.' })
//   }
// })

// 当前用户信息
app.get('/profile', requiresAuth(), (req, res) => {
    //   if (!req.session.userId) {
    //     return res.json({ user: null })
    //   }
    //   res.json({
    //     user: {
    //       id: req.session.userId,
    //       nickname: req.session.nickname
    //     }
    //   })
    res.send(JSON.stringify(req.oidc.user));
})

// 登出
// app.post('/logout', (req, res) => {
//   req.session.destroy(() => {
//     res.json({ ok: true })
//   })
// })

// ---- 漂流瓶 API：带昵称 & 权限控制 ----

// 所有公开漂流瓶（随机池用）
app.get('/data', async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        email: true,
                        nickname: true
                    }
                }
            }
        })
        res.json(messages)
    } catch (err) {
        console.error('GET /data error:', err)
        res.status(500).json({ error: 'Failed to fetch messages.' })
    }
})

// 当前用户历史：只看自己的瓶子
app.get('/my-bottles', requiresAuth(), async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: { userEmail: req.oidc.user.email },
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        email: true,
                        nickname: true
                    }
                }
            }
        })
        res.json(messages)
    } catch (err) {
        console.error('GET /my-bottles error:', err)
        res.status(500).json({ error: 'Failed to fetch your bottles.' })
    }
})

// 创建新漂流瓶（必须登录）
app.post('/data', requiresAuth(), async (req, res) => {
    const { ageGroup, gender, description } = req.body

    try {
        const message = await prisma.message.create({
            data: {
                ageGroup,
                gender,
                description,
                userEmail: req.oidc.user.email
            }
        })
        res.json(message)
    } catch (err) {
        console.error('POST /data error:', err)
        res.status(500).json({ error: 'Failed to save message.' })
    }
})

// 更新漂流瓶（只能改自己的）
app.put('/data/:id', requiresAuth(), async (req, res) => {
    const { id } = req.params
    const { ageGroup, gender, description } = req.body

    try {
        // 先确认这条是自己的
        const existing = await prisma.message.findUnique({ where: { id } })
        if (!existing || existing.userEmail !== req.oidc.user.email) {
            return res.status(403).json({ error: 'You can only edit your own bottles.' })
        }

        const message = await prisma.message.update({
            where: { id },
            data: { ageGroup, gender, description }
        })

        res.json(message)
    } catch (err) {
        console.error('PUT /data error:', err)
        res.status(500).json({ error: 'Failed to update message.' })
    }
})

// 删除漂流瓶（只能删自己的）
app.delete('/data/:id', requiresAuth(), async (req, res) => {
    const { id } = req.params

    try {
        const existing = await prisma.message.findUnique({ where: { id } })
        if (!existing || existing.userEmail !== req.oidc.user.email) {
            return res.status(403).json({ error: 'You can only delete your own bottles.' })
        }

        const deleted = await prisma.message.delete({ where: { id } })
        res.json({ ok: true, deleted })
    } catch (err) {
        console.error('DELETE /data error:', err)
        res.status(500).json({ error: 'Failed to delete message.' })
    }
})

// ---- 原来的 API 路由（如果课程有用到其他端点，继续挂在这里） ----
import apiRoutes from './routes/api.js'
app.use('/', apiRoutes)

const port = 443
app.listen(port, () => {
    console.log(`Express is live at http://localhost:${port}`)
})
