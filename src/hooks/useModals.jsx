import { useState, useMemo } from 'react'

export function useModals() {
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSelectPositionModal, setShowSelectPositionModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showExternalButtonsModal, setShowExternalButtonsModal] = useState(false)
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showPortfolioMenu, setShowPortfolioMenu] = useState(false)

  const api = useMemo(() => ({
    openConfigModal: () => setShowConfigModal(true),
    closeConfigModal: () => setShowConfigModal(false),
    openDeleteConfirm: () => setShowDeleteConfirm(true),
    closeDeleteConfirm: () => setShowDeleteConfirm(false),
    openSelectPositionModal: () => setShowSelectPositionModal(true),
    closeSelectPositionModal: () => setShowSelectPositionModal(false),
    openNoteModal: () => setShowNoteModal(true),
    closeNoteModal: () => setShowNoteModal(false),
    openExternalButtonsModal: () => setShowExternalButtonsModal(true),
    closeExternalButtonsModal: () => setShowExternalButtonsModal(false),
    openProfilePictureModal: () => setShowProfilePictureModal(true),
    closeProfilePictureModal: () => setShowProfilePictureModal(false),
    openUserMenu: () => setShowUserMenu(true),
    closeUserMenu: () => setShowUserMenu(false),
    openPortfolioMenu: () => setShowPortfolioMenu(true),
    closePortfolioMenu: () => setShowPortfolioMenu(false)
  }), [])

  return {
    showConfigModal, setShowConfigModal,
    showDeleteConfirm, setShowDeleteConfirm,
    showSelectPositionModal, setShowSelectPositionModal,
    showNoteModal, setShowNoteModal,
    showExternalButtonsModal, setShowExternalButtonsModal,
    showProfilePictureModal, setShowProfilePictureModal,
    showUserMenu, setShowUserMenu,
    showPortfolioMenu, setShowPortfolioMenu,
    ...api
  }
}

