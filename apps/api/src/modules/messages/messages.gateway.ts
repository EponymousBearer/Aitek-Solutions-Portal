import { AitekRole, CompanyMembershipRole, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { verifyToken } from '@clerk/backend'
import { Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'

import { PrismaService } from '../../prisma/prisma.service'

import { MessagesService, type MessageEvent } from './messages.service'

const room = (projectId: string) => `project:${projectId}`
const internalRoom = (projectId: string) => `project:${projectId}:internal`

// Real-time message delivery. Connections are authenticated with the Clerk
// session token (handshake.auth.token); clients join a project room (+ an
// internal room for AiTek) and receive `message:new` / `message:deleted`.
@WebSocketGateway({
  cors: {
    origin: (process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000').split(','),
    credentials: false,
  },
})
export class MessagesGateway implements OnGatewayInit {
  private readonly logger = new Logger(MessagesGateway.name)

  @WebSocketServer() server!: Server

  constructor(
    private prisma: PrismaService,
    private messages: MessagesService,
  ) {}

  // Authenticate during the handshake. Socket.io awaits this middleware before
  // the connection is established or any client events fire, so socket.data.user
  // is guaranteed set before `room:join` is handled (avoids the race a plain
  // async handleConnection had, which left clients out of the broadcast room).
  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        const auth = socket.handshake.auth as { token?: string } | undefined
        const headerToken = socket.handshake.headers['authorization']?.replace('Bearer ', '')
        const token = auth?.token || headerToken
        if (!token) throw new Error('missing token')

        const payload = await verifyToken(token, {
          secretKey: process.env['CLERK_SECRET_KEY'] ?? '',
        })
        const user = await this.hydrate(payload.sub)
        if (!user) throw new Error('user not found')
        socket.data.user = user
        next()
      } catch {
        next(new Error('unauthorized'))
      }
    })
  }

  @SubscribeMessage('room:join')
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { projectId?: string }) {
    const user = client.data.user as AuthUser | undefined
    const projectId = body?.projectId
    if (!user || !projectId) return { ok: false }
    try {
      await this.messages.assertCanAccess(projectId, user)
    } catch {
      return { ok: false }
    }
    await client.join(room(projectId))
    if (this.isAitek(user)) await client.join(internalRoom(projectId))
    return { ok: true }
  }

  @SubscribeMessage('room:leave')
  async onLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { projectId?: string }) {
    if (body?.projectId) {
      await client.leave(room(body.projectId))
      await client.leave(internalRoom(body.projectId))
    }
    return { ok: true }
  }

  @OnEvent('message.created')
  handleCreated(evt: MessageEvent) {
    const target = evt.isInternal ? internalRoom(evt.projectId) : room(evt.projectId)
    this.server.to(target).emit('message:new', evt.message)
  }

  @OnEvent('message.deleted')
  handleDeleted(evt: MessageEvent) {
    const target = evt.isInternal ? internalRoom(evt.projectId) : room(evt.projectId)
    this.server.to(target).emit('message:deleted', evt.message)
  }

  private isAitek(user: AuthUser): boolean {
    return user.role === UserRole.AITEK_ADMIN || user.role === UserRole.AITEK_TEAM_MEMBER
  }

  // Minimal AuthUser hydration from the DB (mirrors ClerkAuthGuard).
  private async hydrate(clerkId: string): Promise<AuthUser | null> {
    const dbUser = await this.prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        aitekRole: true,
        companyMemberships: {
          where: { isActive: true },
          take: 1,
          select: { companyId: true, role: true },
        },
      },
    })
    if (!dbUser) return null
    const membership = dbUser.companyMemberships[0]
    return {
      id: dbUser.id,
      clerkId,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      role: dbUser.role as UserRole,
      aitekRole: (dbUser.aitekRole as AitekRole | null) ?? undefined,
      companyId: membership?.companyId,
      companyMembershipRole: membership?.role as CompanyMembershipRole | undefined,
    }
  }
}
