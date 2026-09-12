import { useEffect, useState } from 'react'
import type { BoxCharacterDto, PlayerBoxDto, StellaUseDto } from '../api/types'
import { ApiError } from '../api/game-api'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { apiErrorMessage } from '../utils/formatters'
import { replaceFavorite } from './box-presentation'
import { presentStellaResult, type StellaResultPresentation } from './stella-result-presentation'

type Options = {
  initialBox: PlayerBoxDto | null
  onLoadBox: () => Promise<PlayerBoxDto>
  onSetFavorite: (characterId: string, favorite: boolean) => Promise<BoxCharacterDto>
  onUseStella: (characterId: string) => Promise<StellaUseDto>
  stellaRetryCharacterId: string | null
  onCharacterProgressed?: () => Promise<unknown> | unknown
}

export function useBoxCollection({ initialBox, onLoadBox, onSetFavorite, onUseStella, stellaRetryCharacterId, onCharacterProgressed }: Options) {
  const [box, setBox] = useState<PlayerBoxDto | null>(initialBox)
  const [error, setError] = useState<string | null>(null)
  const [favoritePendingId, setFavoritePendingId] = useState<string | null>(null)
  const [stellaPendingId, setStellaPendingId] = useState<string | null>(null)
  const [stellaFeedback, setStellaFeedback] = useState<StellaResultPresentation | null>(null)
  const [stellaRetryId, setStellaRetryId] = useState<string | null>(stellaRetryCharacterId)

  const load = async () => {
    setError(null)
    try {
      const next = await onLoadBox()
      setBox(next)
      return next
    } catch (reason) {
      setError(apiErrorMessage(reason))
      throw reason
    }
  }

  useEffect(() => {
    let active = true
    void onLoadBox().then((next) => {
      if (active) { setBox(next); setError(null) }
    }).catch((reason) => { if (active) setError(apiErrorMessage(reason)) })
    return () => { active = false }
  }, [onLoadBox])

  useEffect(() => {
    if (!stellaFeedback?.visual) return
    const operationId = stellaFeedback.visual.operationId
    const timer = window.setTimeout(() => setStellaFeedback((current) => current?.visual?.operationId === operationId ? { ...current, visual: null } : current), 1_800)
    return () => window.clearTimeout(timer)
  }, [stellaFeedback])

  const toggleFavorite = async (character: BoxCharacterDto) => {
    if (favoritePendingId) return
    const favorite = !character.favorite
    setFavoritePendingId(character.id)
    setBox((current) => current ? { ...current, characters: replaceFavorite(current.characters, character.id, favorite) } : current)
    try {
      const persisted = await onSetFavorite(character.id, favorite)
      setBox((current) => current ? { ...current, characters: current.characters.map((item) => item.id === persisted.id ? persisted : item) } : current)
      setError(null)
    } catch (reason) {
      setBox((current) => current ? { ...current, characters: replaceFavorite(current.characters, character.id, character.favorite) } : current)
      setError(apiErrorMessage(reason))
    } finally { setFavoritePendingId(null) }
  }

  const useStella = async (character: BoxCharacterDto) => {
    if (stellaPendingId) return
    setStellaPendingId(character.id)
    setStellaFeedback(null)
    try {
      const result = await onUseStella(character.id)
      setBox((current) => current ? applyStellaResult(current, result) : current)
      setStellaRetryId(null)
      setStellaFeedback(presentStellaResult(character, result))
      setError(null)
      try {
        await onCharacterProgressed?.()
      } catch {
        setError('Stella utilisée, mais certaines informations n’ont pas pu être actualisées. Rouvrez cet écran pour les synchroniser.')
      }
      void onLoadBox().then(setBox).catch(() => undefined)
    } catch (reason) {
      if (isAmbiguousMutationError(reason)) {
        setStellaRetryId(character.id)
        setError('Résultat incertain : vérifiez votre Box, puis réessayez. La même opération sera reprise sans double utilisation.')
      } else if (reason instanceof ApiError && (reason.code === 'STELLA_IN_PROGRESS' || reason.code === 'STELLA_INTENT_CONFLICT')) {
        setError(apiErrorMessage(reason))
      } else {
        setStellaRetryId(null)
        setError(apiErrorMessage(reason))
      }
    } finally { setStellaPendingId(null) }
  }

  return { box, setBox, error, setError, load, favoritePendingId, stellaPendingId, stellaFeedback, setStellaFeedback, stellaRetryId, toggleFavorite, useStella }
}

function applyStellaResult(box: PlayerBoxDto, result: StellaUseDto): PlayerBoxDto {
  const previous = box.characters.find(({ id }) => id === result.character.id)
  return {
    ...box,
    characters: box.characters.map((character) => character.id === result.character.id ? result.character : character),
    stella: result.stella,
    summary: { ...box.summary, c6: box.summary.c6 + (previous?.constellation !== 6 && result.character.constellation === 6 ? 1 : 0) },
  }
}
