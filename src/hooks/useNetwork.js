import { useEffect, useRef, useState, useCallback } from 'react'
import Peer from 'peerjs'

// PeerJS bağlantı yöneticisi hook'u
export function useNetwork() {
    const [peerId, setPeerId] = useState(null)
    const [roomCode, setRoomCode] = useState('')
    const [isHost, setIsHost] = useState(false)
    const [connections, setConnections] = useState([])
    const [isConnected, setIsConnected] = useState(false)
    const [playerCount, setPlayerCount] = useState(0)
    const [error, setError] = useState(null)
    const [players, setPlayers] = useState([]) // { id, name, avatar, isHost }

    const peerRef = useRef(null)
    const connectionsRef = useRef([])
    const onMessageRef = useRef(null)
    const playersRef = useRef([])

    const generateRoomCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let code = ''
        for (let i = 0; i < 4; i++) {
            code += chars[Math.floor(Math.random() * chars.length)]
        }
        return code
    }

    const updatePlayers = useCallback((newPlayers) => {
        playersRef.current = newPlayers
        setPlayers([...newPlayers])
    }, [])

    const cleanupPeer = useCallback(() => {
        connectionsRef.current.forEach(conn => {
            try { conn.close() } catch (e) { /* ignore */ }
        })
        connectionsRef.current = []
        setConnections([])
        if (peerRef.current) {
            try { peerRef.current.destroy() } catch (e) { /* ignore */ }
            peerRef.current = null
        }
        setPeerId(null)
        setIsConnected(false)
        setPlayerCount(0)
        updatePlayers([])
    }, [updatePlayers])

    const setupConnectionListeners = useCallback((conn) => {
        conn.on('data', (data) => {
            if (onMessageRef.current) {
                onMessageRef.current(data, conn)
            }
            // Host ise, gelen mesajı diğer tüm bağlantılara da ilet
            if (peerRef.current && connectionsRef.current.length > 1) {
                connectionsRef.current.forEach(c => {
                    if (c !== conn && c.open) {
                        try { c.send(data) } catch (e) { /* ignore */ }
                    }
                })
            }
        })

        conn.on('close', () => {
            connectionsRef.current = connectionsRef.current.filter(c => c !== conn)
            setConnections([...connectionsRef.current])
            setPlayerCount(connectionsRef.current.length + 1)
            // Ayrılan oyuncuyu listeden çıkar
            const updated = playersRef.current.filter(p => p.connId !== conn.peer)
            updatePlayers(updated)
        })

        conn.on('error', (err) => {
            console.error('Bağlantı hatası:', err)
        })
    }, [updatePlayers])

    // Oda kurma (Host modu)
    const hostGame = useCallback((playerName, playerAvatar) => {
        return new Promise((resolve, reject) => {
            cleanupPeer()
            const code = generateRoomCode()
            const peerIdStr = `wavelength-${code}`

            const peer = new Peer(peerIdStr, { debug: 0 })

            peer.on('open', (id) => {
                setPeerId(id)
                setRoomCode(code)
                setIsHost(true)
                setIsConnected(true)
                setPlayerCount(1)
                peerRef.current = peer

                // Host kendini oyuncu listesine ekle
                updatePlayers([{ id: id, name: playerName, avatar: playerAvatar, isHost: true, connId: null }])

                resolve(code)
            })

            peer.on('connection', (conn) => {
                conn.on('open', () => {
                    connectionsRef.current.push(conn)
                    setConnections([...connectionsRef.current])
                    setPlayerCount(connectionsRef.current.length + 1)
                    setupConnectionListeners(conn)
                })
            })

            peer.on('error', (err) => {
                console.error('Peer hatası:', err)
                if (err.type === 'unavailable-id') {
                    setError('Bu oda kodu zaten kullanılıyor. Tekrar deneyin.')
                } else {
                    setError('Bağlantı hatası oluştu. Tekrar deneyin.')
                }
                reject(err)
            })

            peer.on('disconnected', () => {
                try { peer.reconnect() } catch (e) { /* ignore */ }
            })
        })
    }, [cleanupPeer, setupConnectionListeners, updatePlayers])

    // Odaya katılma (Client modu)
    const joinGame = useCallback((code, playerName, playerAvatar) => {
        return new Promise((resolve, reject) => {
            cleanupPeer()
            const hostPeerId = `wavelength-${code.toUpperCase()}`
            const myId = `wavelength-${code.toUpperCase()}-${Date.now()}`

            const peer = new Peer(myId, { debug: 0 })

            peer.on('open', () => {
                peerRef.current = peer
                setPeerId(myId)
                setRoomCode(code.toUpperCase())
                setIsHost(false)

                const conn = peer.connect(hostPeerId, { reliable: true })

                conn.on('open', () => {
                    connectionsRef.current = [conn]
                    setConnections([conn])
                    setIsConnected(true)
                    setPlayerCount(2)
                    setupConnectionListeners(conn)
                    resolve(code)
                })

                conn.on('error', (err) => {
                    console.error('Bağlantı hatası:', err)
                    setError('Odaya bağlanılamadı. Kodu kontrol edin.')
                    reject(err)
                })
            })

            peer.on('error', (err) => {
                console.error('Peer hatası:', err)
                setError('Bağlantı hatası. Oda kodu doğru mu?')
                reject(err)
            })

            setTimeout(() => {
                if (!connectionsRef.current.length) {
                    setError('Bağlantı zaman aşımına uğradı. Oda kodu doğru mu?')
                    reject(new Error('Bağlantı zaman aşımı'))
                }
            }, 10000)
        })
    }, [cleanupPeer, setupConnectionListeners])

    // Mesaj gönderme
    const broadcast = useCallback((data) => {
        connectionsRef.current.forEach(conn => {
            if (conn.open) {
                try { conn.send(data) } catch (e) { /* ignore */ }
            }
        })
    }, [])

    // Mesaj dinleyici ayarlama
    const onMessage = useCallback((handler) => {
        onMessageRef.current = handler
    }, [])

    // Temizlik
    useEffect(() => {
        return () => {
            cleanupPeer()
        }
    }, [cleanupPeer])

    return {
        peerId,
        roomCode,
        isHost,
        isConnected,
        playerCount,
        error,
        setError,
        hostGame,
        joinGame,
        broadcast,
        onMessage,
        cleanupPeer,
        players,
        updatePlayers,
        playersRef,
    }
}
