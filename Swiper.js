import React, { Component } from 'react'
import { PanResponder, Text, View, Dimensions, Animated } from 'react-native'
import PropTypes from 'prop-types'
import isEqual from 'lodash/isEqual'

import styles from './styles'

const { height, width } = Dimensions.get('window')
const LABEL_TYPES = {
  NONE: 'none',
  LEFT: 'left',
  RIGHT: 'right',
  TOP: 'top',
  BOTTOM: 'bottom'
}
const SWIPE_MULTIPLY_FACTOR = 4.5

const calculateCardIndexes = (firstCardIndex, cards) => {
  firstCardIndex = firstCardIndex || 0
  const previousCardIndex = firstCardIndex === 0 ? cards.length - 1 : firstCardIndex - 1
  const secondCardIndex = firstCardIndex === cards.length - 1 ? 0 : firstCardIndex + 1
  return { firstCardIndex, secondCardIndex, previousCardIndex }
}

const rebuildStackAnimatedValues = (props) => {
  const stackPositionsAndScales = {}
  const { stackSize, stackSeparation, stackScale } = props

  for (let position = 0; position < stackSize; position++) {
    stackPositionsAndScales[`stackPosition${position}`] = new Animated.Value(stackSeparation * position)
    stackPositionsAndScales[`stackScale${position}`] = new Animated.Value((100 - stackScale * position) * 0.01)
  }

  return stackPositionsAndScales
}

class Swiper extends Component {
  constructor (props) {
    super(props)

    this.state = {
      ...calculateCardIndexes(props.cardIndex, props.cards),
      pan: new Animated.ValueXY(),
      cards: props.cards,
      previousCardX: new Animated.Value(props.previousCardDefaultPositionX),
      previousCardY: new Animated.Value(props.previousCardDefaultPositionY),
      swipedAllCards: false,
      panResponderLocked: false,
      labelType: LABEL_TYPES.NONE,
      slideGesture: false,
      ...rebuildStackAnimatedValues(props)
    }

    this._mounted = true
    this._animatedValueX = 0
    this._animatedValueY = 0

    this.state.pan.x.addListener(value => (this._animatedValueX = value.value))
    this.state.pan.y.addListener(value => (this._animatedValueY = value.value))

    this.initializeCardStyle()
    this.initializePanResponder()
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    const { props, state } = this
    const propsChanged = (
      !isEqual(props.cards, nextProps.cards) ||
      props.cardIndex !== nextProps.cardIndex
    )
    const stateChanged = (
      nextState.firstCardIndex !== state.firstCardIndex ||
      nextState.secondCardIndex !== state.secondCardIndex ||
      nextState.previousCardIndex !== state.previousCardIndex ||
      nextState.labelType !== state.labelType ||
      nextState.swipedAllCards !== state.swipedAllCards
    )
    return propsChanged || stateChanged
  }

  componentDidUpdate(prevProps) {
    if (!isEqual(this.props.cards, prevProps.cards) && this.props.cards.length > 0) {
      this.setCardIndex(this.state.firstCardIndex - 1, false);
    }
  }

  componentWillUnmount = () => {
    this._mounted = false
    this.state.pan.x.removeAllListeners()
    this.state.pan.y.removeAllListeners()
    Dimensions.removeEventListener('change', this.onDimensionsChange)
  }

  getCardStyle = () => {
    const { height, width } = Dimensions.get('window')
    const {
      cardVerticalMargin,
      cardHorizontalMargin,
      marginTop,
      marginBottom
    } = this.props

    const cardWidth = width - cardHorizontalMargin * 2
    const cardHeight =
      height - cardVerticalMargin * 2 - marginTop - marginBottom

    return {
      top: cardVerticalMargin,
      left: cardHorizontalMargin,
      width: cardWidth,
      height: cardHeight
    }
  }

  initializeCardStyle = () => {
    // this.forceUpdate()
    Dimensions.addEventListener('change', this.onDimensionsChange)
  }

  initializePanResponder = () => {
    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: (event, gestureState) => true,
      onMoveShouldSetPanResponder: (event, gestureState) => false,

      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const isVerticalSwipe = Math.sqrt(
          Math.pow(gestureState.dx, 2) < Math.pow(gestureState.dy, 2)
        )
        if (!this.props.verticalSwipe && isVerticalSwipe) {
          return false
        }
        return Math.sqrt(Math.pow(gestureState.dx, 2) + Math.pow(gestureState.dy, 2)) > 10
      },
      onPanResponderGrant: this.onPanResponderGrant,
      onPanResponderMove: this.onPanResponderMove,
      onPanResponderRelease: this.onPanResponderRelease,
      onPanResponderTerminate: this.onPanResponderRelease
    })
  }

  createAnimatedEvent = () => {
    const { horizontalSwipe, verticalSwipe } = this.props
    const { x, y } = this.state.pan
    const dx = horizontalSwipe ? x : new Animated.Value(0)
    const dy = verticalSwipe ? y : new Animated.Value(0)
    return { dx, dy }
  }

  onDimensionsChange = () => {
    this.forceUpdate()
  }

  onPanResponderMove = (event, gestureState) => {
    this.props.onSwiping(this._animatedValueX, this._animatedValueY)

    let { overlayOpacityHorizontalThreshold, overlayOpacityVerticalThreshold } = this.props
    if (!overlayOpacityHorizontalThreshold) {
      overlayOpacityHorizontalThreshold = this.props.horizontalThreshold
    }
    if (!overlayOpacityVerticalThreshold) {
      overlayOpacityVerticalThreshold = this.props.verticalThreshold
    }

    let isSwipingLeft,
      isSwipingRight,
      isSwipingTop,
      isSwipingBottom

    if (Math.abs(this._animatedValueX) > Math.abs(this._animatedValueY) && Math.abs(this._animatedValueX) > overlayOpacityHorizontalThreshold) {
      if (this._animatedValueX > 0) isSwipingRight = true
      else isSwipingLeft = true
    } else if (Math.abs(this._animatedValueY) > Math.abs(this._animatedValueX) && Math.abs(this._animatedValueY) > overlayOpacityVerticalThreshold) {
      if (this._animatedValueY > 0) isSwipingBottom = true
      else isSwipingTop = true
    }

    if (isSwipingRight) {
      this.setState({ labelType: LABEL_TYPES.RIGHT })
    } else if (isSwipingLeft) {
      this.setState({ labelType: LABEL_TYPES.LEFT })
    } else if (isSwipingTop) {
      this.setState({ labelType: LABEL_TYPES.TOP })
    } else if (isSwipingBottom) {
      this.setState({ labelType: LABEL_TYPES.BOTTOM })
    } else {
      this.setState({ labelType: LABEL_TYPES.NONE })
    }

    const { onTapCardDeadZone } = this.props
    if (
      this._animatedValueX < -onTapCardDeadZone ||
      this._animatedValueX > onTapCardDeadZone ||
      this._animatedValueY < -onTapCardDeadZone ||
      this._animatedValueY > onTapCardDeadZone
    ) {
      this.setState({
        slideGesture: true
      })
    }

    return Animated.event([null, this.createAnimatedEvent()], { useNativeDriver: false })(
      event,
      gestureState
    )
  }

  onPanResponderGrant = (event, gestureState) => {
    this.props.dragStart && this.props.dragStart()
    if (!this.state.panResponderLocked) {
      this.state.pan.setOffset({
        x: this._animatedValueX,
        y: this._animatedValueY
      })
    }

    this.state.pan.setValue({
      x: 0,
      y: 0
    })
  }

  validPanResponderRelease = () => {
    const {
      disableBottomSwipe,
      disableLeftSwipe,
      disableRightSwipe,
      disableTopSwipe
    } = this.props

    const {
      isSwipingLeft,
      isSwipingRight,
      isSwipingTop,
      isSwipingBottom
    } = this.getSwipeDirection(this._animatedValueX, this._animatedValueY)

    return (
      (isSwipingLeft && !disableLeftSwipe) ||
      (isSwipingRight && !disableRightSwipe) ||
      (isSwipingTop && !disableTopSwipe) ||
      (isSwipingBottom && !disableBottomSwipe)
    )
  }

  onPanResponderRelease = (e, gestureState) => {
    this.props.dragEnd && this.props.dragEnd()
    if (this.state.panResponderLocked) {
      this.state.pan.setValue({
        x: 0,
        y: 0
      })
      this.state.pan.setOffset({
        x: 0,
        y: 0
      })

      return
    }

    const { horizontalThreshold, verticalThreshold } = this.props

    const animatedValueX = Math.abs(this._animatedValueX)
    const animatedValueY = Math.abs(this._animatedValueY)

    const isSwiping =
      animatedValueX > horizontalThreshold || animatedValueY > verticalThreshold

    if (isSwiping && this.validPanResponderRelease()) {
      const onSwipeDirectionCallback = this.getOnSwipeDirectionCallback(
        this._animatedValueX,
        this._animatedValueY
      )

      this.swipeCard(onSwipeDirectionCallback)
    } else {
      this.resetTopCard()
    }

    if (!this.state.slideGesture) {
      this.props.onTapCard(this.state.firstCardIndex)
    }

    this.setState({
      labelType: LABEL_TYPES.NONE,
      slideGesture: false
    })
  }

  getOnSwipeDirectionCallback = (animatedValueX, animatedValueY) => {
    const {
      onSwipedLeft,
      onSwipedRight,
      onSwipedTop,
      onSwipedBottom
    } = this.props

    const {
      isSwipingLeft,
      isSwipingRight,
      isSwipingTop,
      isSwipingBottom
    } = this.getSwipeDirection(animatedValueX, animatedValueY)

    if (isSwipingRight) {
      return onSwipedRight
    }

    if (isSwipingLeft) {
      return onSwipedLeft
    }

    if (isSwipingTop) {
      return onSwipedTop
    }

    if (isSwipingBottom) {
      return onSwipedBottom
    }
  }

  getSwipeDirection = (animatedValueX, animatedValueY) => {
    const isSwipingLeft = animatedValueX < -this.props.horizontalThreshold
    const isSwipingRight = animatedValueX > this.props.horizontalThreshold
    const isSwipingTop = animatedValueY < -this.props.verticalThreshold
    const isSwipingBottom = animatedValueY > this.props.verticalThreshold

    return { isSwipingLeft, isSwipingRight, isSwipingTop, isSwipingBottom }
  }

  resetTopCard = cb => {
    this.setState({ labelType: LABEL_TYPES.NONE });
    Animated.spring(this.state.pan, {
      toValue: 0,
      friction: this.props.topCardResetAnimationFriction,
      tension: this.props.topCardResetAnimationTension*0.5,
      useNativeDriver: true
    }).start(cb)

    this.state.pan.setOffset({
      x: 0,
      y: 0
    })

    this.props.onSwipedAborted()
  }

  swipeTutorial = () => {
    this.simulateSwipeRight();
  }

  swipeLeft = () => {
    this.swipeCard(
      this.props.onSwipedLeft,
      -this.props.horizontalThreshold,
      0,
      2
    )
  }

  simulateSwipeLeft = () => {
    this.simulateSwipeCard(
      -this.props.horizontalThreshold,
      0,
      2,
      3
    )
  }

  swipeRight = () => {
    this.swipeCard(
      this.props.onSwipedRight,
      this.props.horizontalThreshold,
      0,
      1
    )
  }

  simulateSwipeRight = () => {
    this.simulateSwipeCard(
      this.props.horizontalThreshold,
      0,
      1,
      2
    )
  }

  swipeTop = () => {
    this.swipeCard(
      this.props.onSwipedTop,
      0,
      -this.props.verticalThreshold,
      3
    )
  }

  simulateSwipeTop = () => {
    this.simulateSwipeCard(
      0,
      -this.props.verticalThreshold,
      3,
      4
    )
  }

  swipeBottom = () => {
    this.swipeCard(
      this.props.onSwipedBottom,
      0,
      this.props.verticalThreshold
    )
  }

  swipeCard = (
    onSwiped,
    x = this._animatedValueX,
    y = this._animatedValueY,
    actual,
  ) => {
    switch (actual) {
      case 1:
        this.setState({ labelType: LABEL_TYPES.RIGHT });
        break;

      case 2:
        this.setState({ labelType: LABEL_TYPES.LEFT });
        break;

      case 3:
        this.setState({ labelType: LABEL_TYPES.TOP });
        break;

      default:
        this.setState({ labelType: LABEL_TYPES.NONE });
        break;
    }
    this.setState({ panResponderLocked: true })
    this.animateStack()
    Animated.timing(this.state.pan, {
      toValue: {
        x: x * SWIPE_MULTIPLY_FACTOR,
        y: y * SWIPE_MULTIPLY_FACTOR
      },
      duration: this.props.swipeAnimationDuration,
      useNativeDriver: true
    }).start(() => {
      this.setState({ labelType: LABEL_TYPES.NONE });
      this.incrementCardIndex(onSwiped);
    })
  }

  simulateSwipeCard= (
    x = this._animatedValueX,
    y = this._animatedValueY,
    actual,
    next,
  ) => {
    Animated.delay(350).start(()=>{
      switch (actual) {
        case 1:
          this.setState({ labelType: LABEL_TYPES.RIGHT });
          break;

        case 2:
          this.setState({ labelType: LABEL_TYPES.LEFT });
          break;

        case 3:
          this.setState({ labelType: LABEL_TYPES.TOP });
          break;

        default:
          this.setState({ labelType: LABEL_TYPES.NONE });
          break;
      }

      Animated.timing(this.state.pan, {
        toValue: {
          x: x * 2.0,
          y: y * 2.0
        },
        duration: this.props.swipeAnimationDuration*1.35,
        useNativeDriver: true
      }).start(() => {
        this.resetTopCard();
        switch (next) {
          case 1:
            this.simulateSwipeRight();
            break;

          case 2:
            this.simulateSwipeLeft();
            break;

          case 3:
            this.simulateSwipeTop();
            break;

          default:
            break;
        }
      })
    })
  }

  animateStack = () => {
    const { secondCardIndex, swipedAllCards } = this.state
    let { cards, stackSize, infinite, showSecondCard } = this.props
    let index = secondCardIndex

    while (stackSize-- > 1 && showSecondCard && !swipedAllCards) {
      if (this.state[`stackPosition${stackSize}`] && this.state[`stackScale${stackSize}`]) {
        const newSeparation = this.props.stackSeparation * (stackSize - 1)
        const newScale = (100 - this.props.stackScale * (stackSize - 1)) * 0.01
        Animated.parallel([
          Animated.spring(this.state[`stackPosition${stackSize}`], {
            toValue: newSeparation,
            friction: this.props.stackAnimationFriction,
            tension: this.props.stackAnimationTension,
            useNativeDriver: true
          }),
          Animated.spring(this.state[`stackScale${stackSize}`], {
            toValue: newScale,
            friction: this.props.stackAnimationFriction,
            tension: this.props.stackAnimationTension,
            useNativeDriver: true
          })
        ]).start()
      }

      if (index === cards.length - 1) {
        if (!infinite) break
        index = 0
      } else {
        index++
      }
    }
  }

  incrementCardIndex = onSwiped => {
    const { firstCardIndex } = this.state
    const { infinite } = this.props
    let newCardIndex = firstCardIndex + 1
    let swipedAllCards = false

    this.onSwipedCallbacks(onSwiped)

    const allSwipedCheck = () => newCardIndex === this.props.cards.length

    if (allSwipedCheck()) {
      if (!infinite) {
        this.props.onSwipedAll()
        // onSwipeAll may have added cards
        if (allSwipedCheck()) {
          swipedAllCards = true
        }
      } else {
        newCardIndex = 0;
      }
    }

    this.setCardIndex(newCardIndex, swipedAllCards)
  }

  jumpToCardIndex = newCardIndex => {
    if (this.props.cards[newCardIndex]) {
      this.setCardIndex(newCardIndex, false)
    }
  }

  getCurrentCardIndex = () => {
    return this.state.firstCardIndex;
  }

  onSwipedCallbacks = (swipeDirectionCallback) => {
    const previousCardIndex = this.state.firstCardIndex
    this.props.onSwiped(previousCardIndex, this.props.cards[previousCardIndex])

    if (swipeDirectionCallback) {
      swipeDirectionCallback(previousCardIndex, this.props.cards[previousCardIndex])
    }
  }

  setCardIndex = (newCardIndex, swipedAllCards) => {
    if (this._mounted) {
      this.setState(
        {
          ...calculateCardIndexes(newCardIndex, this.props.cards),
          swipedAllCards: swipedAllCards,
          panResponderLocked: false
        },
        this.resetPanAndScale
      )
    }
  }

  resetPanAndScale = () => {
    const {previousCardDefaultPositionX, previousCardDefaultPositionY} = this.props
    this.state.pan.setValue({ x: 0, y: 0 })
    this.state.previousCardX.setValue(previousCardDefaultPositionX)
    this.state.previousCardY.setValue(previousCardDefaultPositionY)
  }

  calculateOverlayLabelStyle = () => {
    const dynamicStyle = this.props.overlayLabels[this.state.labelType].style
    let overlayLabelStyle = dynamicStyle ? dynamicStyle.label : {}

    if (this.state.labelType === LABEL_TYPES.NONE) {
      overlayLabelStyle = styles.hideOverlayLabel
    }

    return [this.props.overlayLabelStyle, overlayLabelStyle]
  }

  calculateOverlayLabelWrapperStyle = () => {
    const dynamicStyle = this.props.overlayLabels[this.state.labelType].style
    const dynamicWrapperStyle = dynamicStyle ? dynamicStyle.wrapper : {}

    const opacity = this.props.animateOverlayLabelsOpacity
      ? this.interpolateOverlayLabelsOpacity()
      : 1
    return [this.props.overlayLabelWrapperStyle, dynamicWrapperStyle, { opacity }]
  }

  calculateSwipableCardStyle = () => {
    const opacity = this.props.animateCardOpacity
      ? this.interpolateCardOpacity()
      : 1
    const rotation = this.interpolateRotation()

    return [
      styles.card,
      this.getCardStyle(),
      {
        zIndex: 1,
        opacity: opacity,
        transform: [
          { translateX: this.state.pan.x },
          { translateY: this.state.pan.y },
          { rotate: rotation }
        ]
      },
      this.props.cardStyle
    ]
  }

  calculateStackCardZoomStyle = (position) => [
    styles.card,
    this.getCardStyle(),
    {
      zIndex: position * -1,
      transform: [{ scale: this.state[`stackScale${position}`] }, { translateY: this.state[`stackPosition${position}`] }]
    },
    this.props.cardStyle
  ]

  interpolateCardOpacity = () => {
    const animatedValueX = Math.abs(this._animatedValueX)
    const animatedValueY = Math.abs(this._animatedValueY)
    let opacity

    if (animatedValueX > animatedValueY) {
      opacity = this.state.pan.x.interpolate({
        inputRange: this.props.inputCardOpacityRangeX,
        outputRange: this.props.outputCardOpacityRangeX
      })
    } else {
      opacity = this.state.pan.y.interpolate({
        inputRange: this.props.inputCardOpacityRangeY,
        outputRange: this.props.outputCardOpacityRangeY
      })
    }

    return opacity
  }

  interpolateOverlayLabelsOpacity = () => {
    const animatedValueX = Math.abs(this._animatedValueX)
    const animatedValueY = Math.abs(this._animatedValueY)
    let opacity

    if (animatedValueX > animatedValueY) {
      opacity = this.state.pan.x.interpolate({
        inputRange: this.props.inputOverlayLabelsOpacityRangeX,
        outputRange: this.props.outputOverlayLabelsOpacityRangeX
      })
    } else {
      opacity = this.state.pan.y.interpolate({
        inputRange: this.props.inputOverlayLabelsOpacityRangeY,
        outputRange: this.props.outputOverlayLabelsOpacityRangeY
      })
    }

    return opacity
  }

  interpolateRotation = () =>
    this.state.pan.x.interpolate({
      inputRange: this.props.inputRotationRange,
      outputRange: this.props.outputRotationRange
    })

  render = () => {
    const { pointerEvents, backgroundColor, marginTop, marginBottom, containerStyle } = this.props
    return (
      <View
        pointerEvents={pointerEvents}
        style={[
          styles.container,
          {
            backgroundColor: backgroundColor,
            marginTop: marginTop,
            marginBottom: marginBottom
          },
          containerStyle
        ]}
      >
        {this.renderChildren()}
        {this.renderStack()}
      </View>
    )
  }

  renderChildren = () => {
    const { childrenOnTop, children, stackSize, showSecondCard } = this.props

    let zIndex = (stackSize && showSecondCard)
      ? stackSize * -1
      : 1

    if (childrenOnTop) {
      zIndex = 5
    }

    return (
      <View pointerEvents='box-none' style={[styles.childrenViewStyle, { zIndex: zIndex }]}>
        {children}
      </View>
    )
  }

  getCardKey = (cardContent, cardIndex) => {
    const { keyExtractor } = this.props

    if (keyExtractor) {
      return keyExtractor(cardContent)
    }

    return cardIndex
  }

  pushCardToStack = (renderedCards, index, position, key, firstCard) => {
    const { cards } = this.props
    const stackCardZoomStyle = this.calculateStackCardZoomStyle(position)
    const stackCard = this.props.renderCard(cards[index], index)
    const swipableCardStyle = this.calculateSwipableCardStyle()
    const renderOverlayLabel = this.renderOverlayLabel()
    renderedCards.push(
      <Animated.View
        key={key}
        style={firstCard ? swipableCardStyle : stackCardZoomStyle}
        {...this._panResponder.panHandlers}
      >
        {firstCard ? renderOverlayLabel : null}
        {stackCard}
      </Animated.View>
    )
  }

  renderStack = () => {
    const { firstCardIndex, swipedAllCards } = this.state
    const renderedCards = []
    let { cards, stackSize, infinite, showSecondCard } = this.props
    let index = firstCardIndex
    let firstCard = true
    let cardPosition = 0

    while (stackSize-- > 0 && (firstCard || showSecondCard) && !swipedAllCards) {
      const key = this.getCardKey(cards[index], index)
      this.pushCardToStack(renderedCards, index, cardPosition, key, firstCard)

      firstCard = false

      if (index === cards.length - 1) {
        if (!infinite) break
        index = 0
      } else {
        index++
      }
      cardPosition++
    }
    return renderedCards
  }

  renderOverlayLabel = () => {
    const {
      disableBottomSwipe,
      disableLeftSwipe,
      disableRightSwipe,
      disableTopSwipe,
      overlayLabels
    } = this.props
    const { labelType } = this.state

    const labelTypeNone = labelType === LABEL_TYPES.NONE
    const directionSwipeLabelDisabled =
      (labelType === LABEL_TYPES.BOTTOM && disableBottomSwipe) ||
      (labelType === LABEL_TYPES.LEFT && disableLeftSwipe) ||
      (labelType === LABEL_TYPES.RIGHT && disableRightSwipe) ||
      (labelType === LABEL_TYPES.TOP && disableTopSwipe)

    if (
      !overlayLabels ||
      !overlayLabels[labelType] ||
      labelTypeNone ||
      directionSwipeLabelDisabled
    ) {
      return null
    }

    return (
      <Animated.View style={this.calculateOverlayLabelWrapperStyle()}>
        {!overlayLabels[labelType].element &&
          <Text style={this.calculateOverlayLabelStyle()}>
            {overlayLabels[labelType].title}
          </Text>
        }

        {overlayLabels[labelType].element &&
          overlayLabels[labelType].element
        }
      </Animated.View>
    )
  }
}

Swiper.propTypes = {
  animateCardOpacity: PropTypes.bool,
  animateOverlayLabelsOpacity: PropTypes.bool,
  backgroundColor: PropTypes.string,
  cardHorizontalMargin: PropTypes.number,
  cardIndex: PropTypes.number,
  cardStyle: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
  cardVerticalMargin: PropTypes.number,
  cards: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,
  containerStyle: PropTypes.object,
  children: PropTypes.any,
  childrenOnTop: PropTypes.bool,
  dragEnd: PropTypes.func,
  dragStart: PropTypes.func,
  disableBottomSwipe: PropTypes.bool,
  disableLeftSwipe: PropTypes.bool,
  disableRightSwipe: PropTypes.bool,
  disableTopSwipe: PropTypes.bool,
  goBackToPreviousCardOnSwipeBottom: PropTypes.bool,
  goBackToPreviousCardOnSwipeLeft: PropTypes.bool,
  goBackToPreviousCardOnSwipeRight: PropTypes.bool,
  goBackToPreviousCardOnSwipeTop: PropTypes.bool,
  horizontalSwipe: PropTypes.bool,
  horizontalThreshold: PropTypes.number,
  infinite: PropTypes.bool,
  inputCardOpacityRangeX: PropTypes.array,
  inputCardOpacityRangeY: PropTypes.array,
  inputOverlayLabelsOpacityRangeX: PropTypes.array,
  inputOverlayLabelsOpacityRangeY: PropTypes.array,
  inputCardOpacityRange: PropTypes.array,
  inputRotationRange: PropTypes.array,
  keyExtractor: PropTypes.func,
  marginBottom: PropTypes.number,
  marginTop: PropTypes.number,
  onSwiped: PropTypes.func,
  onSwipedAborted: PropTypes.func,
  onSwipedAll: PropTypes.func,
  onSwipedBottom: PropTypes.func,
  onSwipedLeft: PropTypes.func,
  onSwipedRight: PropTypes.func,
  onSwipedTop: PropTypes.func,
  onSwiping: PropTypes.func,
  onTapCard: PropTypes.func,
  onTapCardDeadZone: PropTypes.number,
  outputCardOpacityRangeX: PropTypes.array,
  outputCardOpacityRangeY: PropTypes.array,
  outputOverlayLabelsOpacityRangeX: PropTypes.array,
  outputOverlayLabelsOpacityRangeY: PropTypes.array,
  outputRotationRange: PropTypes.array,
  outputCardOpacityRange: PropTypes.array,
  overlayLabels: PropTypes.object,
  overlayLabelStyle: PropTypes.object,
  overlayLabelWrapperStyle: PropTypes.object,
  overlayOpacityHorizontalThreshold: PropTypes.number,
  overlayOpacityVerticalThreshold: PropTypes.number,
  pointerEvents: PropTypes.oneOf(['box-none', 'none', 'box-only', 'auto']),
  previousCardDefaultPositionX: PropTypes.number,
  previousCardDefaultPositionY: PropTypes.number,
  renderCard: PropTypes.func.isRequired,
  secondCardZoom: PropTypes.number,
  showSecondCard: PropTypes.bool,
  stackAnimationFriction: PropTypes.number,
  stackAnimationTension: PropTypes.number,
  stackScale: PropTypes.number,
  stackSeparation: PropTypes.number,
  stackSize: PropTypes.number,
  swipeAnimationDuration: PropTypes.number,
  swipeBackCard: PropTypes.bool,
  topCardResetAnimationFriction: PropTypes.number,
  topCardResetAnimationTension: PropTypes.number,
  verticalSwipe: PropTypes.bool,
  verticalThreshold: PropTypes.number,
  zoomAnimationDuration: PropTypes.number,
  zoomFriction: PropTypes.number
}

Swiper.defaultProps = {
  animateCardOpacity: false,
  animateOverlayLabelsOpacity: false,
  backgroundColor: '#4FD0E9',
  cardHorizontalMargin: 20,
  cardIndex: 0,
  cardStyle: {},
  cardVerticalMargin: 60,
  childrenOnTop: false,
  containerStyle: {},
  disableBottomSwipe: false,
  disableLeftSwipe: false,
  disableRightSwipe: false,
  disableTopSwipe: false,
  horizontalSwipe: true,
  horizontalThreshold: width / 4,
  goBackToPreviousCardOnSwipeBottom: false,
  goBackToPreviousCardOnSwipeLeft: false,
  goBackToPreviousCardOnSwipeRight: false,
  goBackToPreviousCardOnSwipeTop: false,
  infinite: false,
  inputCardOpacityRangeX: [-width / 2, -width / 3, 0, width / 3, width / 2],
  inputCardOpacityRangeY: [-height / 2, -height / 3, 0, height / 3, height / 2],
  inputOverlayLabelsOpacityRangeX: [
    -width / 3,
    -width / 4,
    0,
    width / 4,
    width / 3
  ],
  inputOverlayLabelsOpacityRangeY: [
    -height / 4,
    -height / 5,
    0,
    height / 5,
    height / 4
  ],
  inputRotationRange: [-width / 2, 0, width / 2],
  keyExtractor: null,
  marginBottom: 0,
  marginTop: 0,
  onSwiped: cardIndex => { },
  onSwipedAborted: () => { },
  onSwipedAll: () => { },
  onSwipedBottom: cardIndex => { },
  onSwipedLeft: cardIndex => { },
  onSwipedRight: cardIndex => { },
  onSwipedTop: cardIndex => { },
  onSwiping: () => { },
  onTapCard: (cardIndex) => { },
  onTapCardDeadZone: 5,
  outputCardOpacityRangeX: [0.8, 1, 1, 1, 0.8],
  outputCardOpacityRangeY: [0.8, 1, 1, 1, 0.8],
  outputOverlayLabelsOpacityRangeX: [1, 0, 0, 0, 1],
  outputOverlayLabelsOpacityRangeY: [1, 0, 0, 0, 1],
  outputRotationRange: ['-10deg', '0deg', '10deg'],
  overlayLabels: null,
  overlayLabelStyle: {
    fontSize: 45,
    fontWeight: 'bold',
    borderRadius: 10,
    padding: 10,
    overflow: 'hidden'
  },
  overlayLabelWrapperStyle: {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 2,
    flex: 1,
    width: '100%',
    height: '100%'
  },
  overlayOpacityHorizontalThreshold: width / 4,
  overlayOpacityVerticalThreshold: height / 5,
  pointerEvents: 'auto',
  previousCardDefaultPositionX: -width,
  previousCardDefaultPositionY: -height,
  secondCardZoom: 0.97,
  showSecondCard: true,
  stackAnimationFriction: 7,
  stackAnimationTension: 40,
  stackScale: 3,
  stackSeparation: 10,
  stackSize: 1,
  swipeAnimationDuration: 350,
  swipeBackCard: false,
  topCardResetAnimationFriction: 7,
  topCardResetAnimationTension: 40,
  verticalSwipe: true,
  verticalThreshold: height / 5,
  zoomAnimationDuration: 100,
  zoomFriction: 7
}

export default Swiper
