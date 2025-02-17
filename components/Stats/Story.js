import React, {Component} from 'react'
import {gql, graphql} from 'react-apollo'
import {compose} from 'redux'
import {range, descending, mean, median, max} from 'd3-array'
import {nest} from 'd3-collection'
import {css} from 'glamor'
import md from 'markdown-in-js'

import withMe from '../../lib/withMe'
import withT from '../../lib/withT'
import mdComponents from '../../lib/utils/mdComponents'

import Loader from '../Loader'
import {ListWithQuery as TestimonialList} from '../Testimonial/List'
import Meta from '../Frame/Meta'
import {HEADER_HEIGHT, HEADER_HEIGHT_MOBILE, MENUBAR_HEIGHT} from '../Frame/constants'

import BarChart from './BarChart'
import PostalCodeMap from './Map'
import List, {Item, Highlight} from '../List'

import Share from '../Share'

import {
  Interaction, A, Label,
  H1, H2, P, NarrowContainer,
  Field,
  fontFamilies, colors,
  mediaQueries
} from '@project-r/styleguide'

import {
  PUBLIC_BASE_URL, STATIC_BASE_URL,
  STATS_POLL_INTERVAL_MS,
  CROWDFUNDING_NAME
} from '../../constants'

import {swissTime, countFormat} from '../../lib/utils/formats'

const dateFormat = swissTime.format('%A %-d.%-m.')

const {H3} = Interaction

const styles = {
  dateContainer: css({
  }),
  dateBox: css({
    float: 'left',
    width: '50%',
    [mediaQueries.mUp]: {
      width: '25%'
    },
    textAlign: 'center'
  }),
  dateBoxBig: css({
    width: '100%',
    marginBottom: 20,
    [mediaQueries.mUp]: {
      width: '50%'
    }
  }),
  dateCount: css({
    paddingBottom: 0,
    fontSize: 20
  }),
  dateLabel: css({
    display: 'block',
    paddingBottom: 0
  }),
  dateLabelBig: css({
    textAlign: 'left'
  }),
  dateCountBig: css({
    textAlign: 'left',
    paddingBottom: 0,
    fontSize: 20
  }),
  keyMetricContainer: css({
    margin: '20px 0'
  }),
  keyMetric: css({
    float: 'left',
    width: '50%',
    height: 95,
    [mediaQueries.mUp]: {
      height: 110
    },
    paddingTop: 10,
    textAlign: 'center'
  }),
  keyMetricNumber: css({
    fontFamily: fontFamilies.sansSerifMedium,
    fontSize: 36,
    [mediaQueries.mUp]: {
      fontSize: 44
    }
  }),
  keyMetricLabel: css({
    fontFamily: fontFamilies.sansSerifRegular,
    fontSize: 16,
    [mediaQueries.mUp]: {
      fontSize: 22
    }
  }),
  keyMetricDetail: css({
    fontFamily: fontFamilies.sansSerifRegular,
    fontSize: 10,
    [mediaQueries.mUp]: {
      fontSize: 12
    }
  }),
  mapStory: css({
    position: 'relative'
  }),
  mapFixed: css({
    position: 'fixed',
    top: HEADER_HEIGHT_MOBILE + MENUBAR_HEIGHT,
    [mediaQueries.mUp]: {
      top: HEADER_HEIGHT
    },
    left: 0,
    right: 0
  }),
  scrollBlock: css({
    position: 'relative',
    marginLeft: -5,
    marginRight: -5,
    padding: '20px 5px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)'
  }),
  spacer: css({
    pointerEvents: 'none',
    height: '75vh',
    '@media (max-height: 450px)': {
      height: '65vh'
    },
    '@media (max-height: 670px)': {
      height: '70vh'
    }
  }),
  opaqueContainer: css({
    position: 'relative',
    backgroundColor: '#fff',
    paddingTop: 40,
    paddingBottom: 100,
    marginBottom: -100
  }),
  date: css({
    fontFamily: fontFamilies.sansSerifMedium,
    fontSize: 17,
    lineHeight: '25px',
    letterSpacing: -0.19
  }),
  dateText: css({
    display: 'inline-block',
    marginRight: 10
  }),
  dateData: css({
    fontFamily: fontFamilies.sansSerifRegular,
    padding: '1px 6px',
    display: 'inline-block',
    borderRadius: 4,
    backgroundColor: colors.primary,
    color: '#fff'
  })
}

const Spacer = ({height}) => (
  <div {...styles.spacer} style={{height: height}} />
)

const normalizeDateData = values => {
  const hourIndex = values.reduce(
    (index, {datetime, count}) => {
      index[datetime.getHours()] = count
      return index
    },
    {}
  )
  return range(0, 24).map(i => ({
    hour: i,
    count: hourIndex[i] || 0
  }))
}

const naturalWordJoin = words => {
  if (words.length <= 1) {
    return words[0]
  }
  return [
    words.slice(0, -2).join(', '),
    words.slice(-2).join(' und ')
  ].filter(Boolean).join(', ')
}
const countryWithArticle = {
  USA: 'den USA',
  'Königreich Belgien': 'dem Königreich Belgien',
  'Niederlande': 'den Niederlanden',
  'Volksrepublik China': 'der Volksrepublik China'
}
const countryNames = values => {
  const names = values.map(d => (
    countryWithArticle[d.name] || d.name
  ))
  return naturalWordJoin(names)
}

const agesZurich = require('./data/agesZurich.json')
const agesCh = require('./data/agesCh.json')

const paymentMethodNames = {
  STRIPE: 'Visa/Mastercard',
  PAYMENTSLIP: 'Einzahlungsschein',
  PAYPAL: 'PayPal',
  POSTFINANCECARD: 'PostFinance Card'
}

const paymentMethodDetails = {
  paperInvoice: 'Rechnungen per Post'
}

export const metaData = {
  url: `${PUBLIC_BASE_URL}/updates/wer-sind-sie`,
  pageTitle: 'Wer sind Sie? Republik',
  title: 'Datenvisualisierung Republik-Mitglieder',
  emailSubject: 'Wer sind Sie?',
  tweet: 'Wer sind Sie?',
  image: `${STATIC_BASE_URL}/static/social-media/wer-sind-sie.png?1`
}

class Story extends Component {
  constructor (...args) {
    super(...args)

    this.state = {}
    this.refs = {}
    this.blocks = {}

    this.refKeys = 'start zh ag cities plz dach'
      .split(' ')

    this.refKeys.map(key => {
      this.blocks[key] = {
        key,
        setRef: (ref) => {
          this.blocks[key].ref = ref
        }
      }
    })

    this.onScroll = () => {
      const y = window.pageYOffset
      const cx = y + window.innerHeight / 2
      const calcDistance = block => Math.min(
        Math.abs(block.y0 - cx),
        Math.abs(block.y1 - cx)
      )
      const activeBlock = this.refKeys
        .reduce(
          (active, key) => {
            if (calcDistance(this.blocks[key]) < calcDistance(this.blocks[active])) {
              return key
            }
            return active
          }
        )

      if (this.state.activeBlock !== activeBlock) {
        this.setState(() => ({
          activeBlock
        }))
      }
    }
    this.measure = () => {
      const y = window.pageYOffset
      this.refKeys.forEach(key => {
        const block = this.blocks[key]
        const {top, height} = block.ref
          .getBoundingClientRect()
        block.y0 = y + top
        block.y1 = block.y0 + height
      })
      const width = window.innerWidth
      const windowHeight = window.innerHeight
      if (
        this.state.width !== width ||
        this.state.windowHeight !== windowHeight
      ) {
        this.setState(() => ({
          width,
          windowHeight
        }))
      }
      this.onScroll()
    }
  }
  componentDidMount () {
    window.addEventListener('scroll', this.onScroll)
    window.addEventListener('resize', this.measure)
    this.measure()
  }
  componentDidUpdate () {
    this.measure()
  }
  componentWillUnmount () {
    window.removeEventListener('scroll', this.onScroll)
    window.removeEventListener('resize', this.measure)
  }
  render () {
    const {
      countryIndex,
      paddedAges,
      ageStats,
      groupedCreatedAts,
      maxCreatedAt,
      maxCreatedAtI2,
      status,
      hasEnded,
      paymentMethods,
      allPostalCodes,
      geoStats,
      testimonialStats,
      foreignCountries,
      me
    } = this.props
    const {
      width, windowHeight
    } = this.state

    const {filter, activeBlock} = this.state

    let filteredPlz = []
    let mapLabels = []
    let mapLabelOptions = {}
    let mapExtend = countryIndex.Schweiz.postalCodes
    let mapExtendPadding = {
      left: 10,
      right: 10
    }
    switch (activeBlock) {
      case 'zh':
        mapLabelOptions.center = true
        mapLabelOptions.postalCode = true
        mapExtendPadding.top = 50
        mapExtendPadding.bottom = windowHeight
          ? windowHeight * 0.3
          : undefined
        mapExtend = countryIndex.Schweiz.postalCodes
          .filter(d => (
            d.postalCode &&
            d.postalCode.startsWith('80')
          ))
        mapLabels = mapExtend
        break
      case 'cities':
        mapLabels = ['2502', '3006', '4058', '8400', '6006', '8032', '4600']
        mapLabelOptions.xOffset = 2
        mapExtendPadding.left = 50
        mapExtendPadding.right = 70
        mapExtend = countryIndex.Schweiz.postalCodes
          .filter(d => (
            d.postalCode &&
            (
              d.name === 'Bern' ||
              d.name === 'Basel' ||
              d.name === 'Winterthur' ||
              d.name === 'Luzern'
            )
          ))
        break
      case 'ag':
        mapLabels = ['5000', '5400']
        mapLabelOptions.xOffset = 2
        mapExtend = countryIndex.Schweiz.postalCodes
          .filter(d => (
            d.postalCode &&
            d.postalCode.startsWith('5')
          ))
        break
      case 'plz':
        if (!filter || !filter.trim()) {
          break
        }
        filteredPlz = allPostalCodes
          .filter(({postalCode}) => postalCode && postalCode.startsWith(filter))
          .sort((a, b) => descending(a.count, b.count))
        if (filteredPlz.length) {
          mapLabelOptions.center = true
          mapLabelOptions.postalCode = true
          const firstMatch = filteredPlz[0]
          const countryName = firstMatch.country.name
          mapExtend = filteredPlz
            .filter(d => d.country.name === countryName)
          mapLabels = mapExtend.slice(0, 10)
          mapExtend = [
            {
              ...firstMatch,
              lon: firstMatch.lon - 0.1,
              lat: firstMatch.lat - 0.1
            },
            ...mapExtend,
            {
              ...firstMatch,
              lon: firstMatch.lon + 0.1,
              lat: firstMatch.lat + 0.1
            }
          ]
          mapExtendPadding.left = 100
          mapExtendPadding.right = 100
        }
        break
      case 'dach':
        mapLabels = [
          {
            name: 'Deutschland',
            labels: [
              ['10435', 'Berlin'],
              ['80339', 'München'],
              ['60594', 'Frankfurt am Main'],
              ['20359', 'Hamburg']
            ]
          },
          {
            name: 'Österreich',
            labels: [
              ['1020', 'Wien']
            ]
          },
          {
            name: 'Königreich Belgien',
            labels: [
              ['1000', 'Brüssel']
            ]
          }
        ].reduce(
          (labels, country) => {
            const data = countryIndex[country.name]
            if (data && data.postalCodes) {
              country.labels.forEach(([code, label]) => {
                const d = data.postalCodes.find(p => p.postalCode === code)
                if (d) {
                  labels.push({
                    ...d,
                    name: label
                  })
                }
              })
            }
            return labels
          },
          []
        )
        mapLabelOptions.xOffset = 5
        mapExtend = []
          .concat(countryIndex.Deutschland.postalCodes)
          .concat(countryIndex['Österreich'].postalCodes)
          .concat(countryIndex.Schweiz.postalCodes)
        break
    }
    if (mapLabels.length && typeof mapLabels[0] === 'string') {
      mapLabels = allPostalCodes
        .filter(d => mapLabels.indexOf(d.postalCode) !== -1)
    }

    metaData.description = `Wer sind Sie? ${status.people} Mitglieder der Republik in Grafiken. Jetzt auch Mitmachen? Unterstützen Sie unser Crowdfunding auf www.republik.ch.`

    return (
      <div>
        <Meta data={metaData} />
        <div {...styles.mapStory}>
          <div {...styles.mapFixed}>
            <PostalCodeMap
              labels={mapLabels}
              labelOptions={mapLabelOptions}
              extentData={mapExtend}
              extentPadding={mapExtendPadding}
              data={allPostalCodes} />
          </div>
          <NarrowContainer>
            <Spacer height='40vh' />
            <div {...styles.scrollBlock}>
              <H1>Wer sind Sie?</H1>
              <div {...styles.date}>
                <span {...styles.dateText}>15. Mai 2017 07 Uhr</span>
                {' '}
                <span {...styles.dateData}>
                  laufend aktualisiert
                </span>
              </div>
              <P>Ladies and Gentlemen</P>

              <P>
                Wir haben zum Start der Republik einiges darüber geschrieben, wer wir sind. Nun ist mehr als die Hälfte der Kampagne vorbei. Und wir können endlich über ein wirklich interessantes Thema reden: wer Sie sind.
              </P>
            </div>

            <div {...styles.scrollBlock}
              ref={this.blocks.start.setRef}>
              <H2>Wo wohnen Sie?</H2>

              <P>
                Hier also die Verteilung der Republik-Mitglieder in der Schweiz. Jeder Punkt auf der Karte repräsentiert eine Postleitzahl. Je fetter der Punkt, desto mehr von Ihnen leben dort. (Die Summe entspricht nicht ganz {countFormat(status.people)} – da nur knapp {Math.ceil(geoStats.hasValuePercent)} Prozent ihre Postadresse angaben.)
              </P>
            </div>

            <Spacer />

            <div {...styles.scrollBlock}
              ref={this.blocks.zh.setRef}>
              <P>Ein paar Fakten dazu.</P>

              <P>
                Zürich ist zwar eine Hochburg für die Republik. Aber bei weitem nicht das alleinige Verbreitungsgebiet.<br />
                {countFormat(geoStats.zurich)} von Ihnen wohnen dort – rund {Math.round(geoStats.zurich / status.people * 100)} Prozent.</P>
            </div>

            <Spacer />

            <div {...styles.scrollBlock}
              ref={this.blocks.cities.setRef}>
              <P>Auf Zürich folgen die Städte Bern ({geoStats.bern} Abonnentinnen), Basel ({geoStats.basel}), Winterthur ({geoStats.winterthur}) und Luzern ({geoStats.luzern}).</P>
            </div>

            <Spacer />

            <div {...styles.scrollBlock}
              ref={this.blocks.ag.setRef}>
              <P>Was uns besonders freut, ist die relative Stärke der Republik am Geburtsort der Helvetischen Republik, in Aarau, mit {geoStats.aarau} Abonnenten, verstärkt durch Baden ({geoStats.baden}) und die Agglomeration von Baden ({geoStats.badenAgglo}).</P>
            </div>

            <Spacer />

            <div style={{minHeight: 230}}>
              <div {...styles.scrollBlock}
                ref={this.blocks.plz.setRef}>
                <P>
                  Weitere {countFormat(
                    countryIndex.Schweiz.count -
                    geoStats.zurich -
                    geoStats.bern -
                    geoStats.basel -
                    geoStats.winterthur -
                    geoStats.luzern -
                    geoStats.baden -
                    geoStats.badenAgglo
                  )} von Ihnen verstreuen sich über die ganze Schweiz.</P>

                <H3>Ihre Postleitzahlen nachschlagen</H3>
                <Field
                  label='Postleitzahl'
                  value={filter || ''}
                  onChange={(_, value) => {
                    this.setState({
                      filter: value
                    })
                  }} />
                <div style={{padding: '10px 0'}}>
                  {filteredPlz.length > 0 && <List>
                    {filteredPlz
                      .slice(0, 5)
                      .map(({postalCode, name, count}) => (
                        <Item key={postalCode}>
                          {postalCode} {name}: <Highlight>{count}</Highlight>
                        </Item>
                      ))}
                  </List>}
                </div>
              </div>
            </div>

            <Spacer />

            <div {...styles.scrollBlock}
              ref={this.blocks.dach.setRef}>
              <P>
                Im Ausland führt {countryNames(foreignCountries.top.values)} mit {countFormat(+foreignCountries.top.key)} Republik-Mitgliedern vor
                {' '}
                {
                  foreignCountries.list.map(group => [
                    countryNames(group.values),
                    ` mit ${group.values.length > 1 ? 'je ' : ''}`,
                    countFormat(+group.key)
                  ].join('')).join(', ')
                }
                {' '}Abonnements.
              </P>

              <P>Ein einziges Mitglied der Republik finden wir jeweils in {countryNames(foreignCountries.single.values)}. Einen Gruss Ihnen allen in Ihre Exklusivität und Einsamkeit!</P>
              <Label>Geometrische Grundlage: <A href='http://www.geonames.org/postal-codes/' target='_blank'>geonames.org</A></Label>
            </div>
          </NarrowContainer>
        </div>
        <div {...styles.opaqueContainer}>
          <NarrowContainer>
            <H2 style={{marginTop: 40}}>Wie alt sind Sie?</H2>

            <H3>
              16- bis 92-jährige Republik-Mitglieder
            </H3>
            <Interaction.P style={{marginBottom: 20, color: colors.secondary, lineHeight: 1.25}}>
              Altersverteilung der <span style={{color: colors.primary}}>Republik-Mitglieder</span> im Vergleich zur Bevölkerung von <span style={{color: '#000'}}>Zürich</span> und der <span style={{color: '#9F2500'}}>Schweiz</span>.
            </Interaction.P>
            <BarChart
              yLabel='Republik-Mitglieder'
              title={d => `${d.age} Jahre: ${d.count} Republik-Mitgliede(r)`}
              data={paddedAges}
              color={() => '#00B400'}
              paddingLeft={40}
              xLabel='Alter'
              xTick={(d, i) => {
                if ((i === 0 && width > 500) || d.age % 10 === 0) {
                  return d.age
                }
                return ''
              }}
              referenceLines={[
                {color: '#000', data: agesZurich},
                {color: 'red', data: agesCh}
              ]} />
            <div style={{paddingTop: 10, textAlign: 'right'}}>
              <A href='https://data.stadt-zuerich.ch/dataset/bev_bestand_jahr_quartier_alter_herkunft_geschlecht'>
                <Label>Zürcher Bevölkerung 2016: Statistik&nbsp;Stadt&nbsp;Zürich</Label>
              </A>
              <br />
              <A href='https://www.bfs.admin.ch/bfs/de/home/statistiken/bevoelkerung.assetdetail.80423.html'>
                <Label>Schweizer Bevölkerung 2015: BFS&nbsp;STATPOP</Label>
              </A>
            </div>

            <P>
              Bei dieser Frage machten {countFormat(ageStats.noValue)} Personen (noch) keine Angabe. Von den restlichen {countFormat(ageStats.hasValue)} sind:
            </P>

            <P>
              {ageStats.below16}
              {' '}Abonnenten jünger als 16 Jahre. Bei der Mehrheit handelt es sich allerdings nicht um frühreife Kinder, sondern um Abonnements von Firmen. Diese gaben ihr Gründungsjahr an.
            </P>

            <P>
              {ageStats.above100}
              {' '}Abonnentinnen älter als 100 Jahre. Wir vermuten allerdings bei den meisten Eingabefehler. Oder einen symbolischen Wink. Etwa beim Geburtsjahr 1848 – dem Gründungsjahr des schweizerischen Bundesstaates. Oder beim 8. Dezember 1873, dem Geburtstag des <A href='https://de.wikipedia.org/wiki/Anton_Afritsch_(Journalist)'>Journalisten Anton Afritsch</A> – oder beim 19. Dezember 1878, an dem der <A href='https://de.wikipedia.org/wiki/Bayard_Taylor'>Reiseschriftsteller Bayard Taylor</A> gestorben ist.
            </P>

            <H2 style={{marginTop: 80}}>
              Welches Geschlecht haben Sie?
            </H2>

            <P>
              Wir haben uns bei anderen Anbietern immer gefragt, was das soll, wenn das m/w-Kästchen angeklickt werden muss. Und haben überdies den ehrgeizigen Plan, für Ladies wie für Gentlemen zu schreiben. Deshalb haben wir diese Frage nicht gestellt.
            </P>

            <H2 style={{marginTop: 80}}>Wie schnell waren Sie?</H2>

            <P>
              Laut Theorie verlaufen Crowdfundings gern dramatisch: Am Anfang gibt es einen Höhepunkt, am Ende gibt es einen Höhepunkt, dazwischen dümpelt es vor sich hin. Die Republik machte mit ihrem Raketenstart keine Ausnahme.
            </P>
            <div {...styles.dateContainer}>
              {groupedCreatedAts.map(({key, values}, i) => (
                <div key={key} {...styles.dateBox} className={i < 2 ? styles.dateBoxBig : ''}>
                  {i < 2 && (
                    <div>
                      <div {...styles.dateLabelBig}>
                        {dateFormat(values[0].datetime)}
                      </div>
                      <div {...styles.dateCountBig}>
                        {values.reduce(
                          (sum, d) => sum + d.count,
                          0
                        )}
                      </div>
                    </div>
                  )}
                  <BarChart
                    height={i < 2 ? 160 : 80}
                    max={i < 2 ? maxCreatedAt : maxCreatedAtI2}
                    yLabel={
                      (
                        (i === 0 && 'Republik-Mitglieder') ||
                        (i === 2 && ' ')
                      )
                    }
                    yLinePadding={(i === 0 || i === 2) ? 30 : 0}
                    xLabel={i === 0 ? 'Zeit' : ''}
                    xTick={i < 2 && ((d) => {
                      if ((i !== 0 || d.hour) && d.hour % 6 === 0) {
                        return `${d.hour}h`
                      }
                      return ''
                    })}
                    title={d => `${d.hour}h: ${d.count}`}
                    color={() => colors.secondary}
                    data={normalizeDateData(values)} />
                  {i >= 2 && (<Label {...styles.dateLabel}>
                    {dateFormat(values[0].datetime)}
                  </Label>)}
                  {i >= 2 && (<div {...styles.dateCount}>
                    {values.reduce(
                      (sum, d) => sum + d.count,
                      0
                    )}
                  </div>)}
                </div>
              ))}
            </div>
            <br style={{clear: 'left'}} />

            <H2 style={{marginTop: 80}}>
              Wie zahlten Sie?
            </H2>
            <P>
              Diese Statistik veröffentlichen wir, weil das sonst kaum eine andere Firma macht – Zahlungsdaten gelten als Geschäftsgeheimnis. Wir folgen dieser Praxis nicht – und hoffen, dass irgendwer irgendetwas aus unserer Statistik lernt.
            </P>

            <Interaction.H3>
              Zahlungsmittel der Unterstützer
            </Interaction.H3>
            <Interaction.P>
              Mit diesen Zahlungsmitteln haben Sie bezahlt.
            </Interaction.P>

            <div {...styles.keyMetricContainer}>
              {paymentMethods
                .map(({method, count, details}) => {
                  return (
                    <div key={method} {...styles.keyMetric}>
                      <div {...styles.keyMetricLabel}>
                        {paymentMethodNames[method]}
                      </div>
                      <div {...styles.keyMetricNumber}>
                        {count}
                      </div>
                      {details
                        .filter(({detail}) => paymentMethodDetails[detail])
                        .map(({detail, count}) => (
                          <div key={detail} {...styles.keyMetricDetail}>
                            {count} {paymentMethodDetails[detail]}
                          </div>
                        ))
                      }
                    </div>
                  )
                })}
              <br style={{clear: 'left'}} />
            </div>

            <P>
              Was uns übrigens verblüffte: PayPal schlug als Zahlungsmethode die PostFinance.
            </P>

            <H2 style={{marginTop: 80}}>
              Wie viele von Ihnen sind auf der Community-Seite dabei?
            </H2>
            <P>
              Enorm viele. Rund {Math.round(testimonialStats.count / status.people * 100)} Prozent von Ihnen – {testimonialStats.count} Leute – luden ein Foto und einen Slogan auf unsere Seite hoch.
              Danke dafür! Für die {testimonialStats.count} Fotos, die Unterstützung, die Begründungen und die Ratschläge! Stellvertretend für alle wollen wir nur eine Stimme zitieren – das vermutlich geografisch (und mental) am weitesten entfernte Mitglied, direkt aus seinem Bunker auf dem Todesstern:
            </P>

            <TestimonialList
              limit={0}
              onSelect={() => {}}
              firstId='bbaf5f0d-3be0-4886-bd24-544f64d518ab' />

            {md(mdComponents)`
Das war alles, was wir über Sie wissen. Ausser, natürlich, noch zwei Dinge:

1. Dass Sie (Unzutreffendes streichen) entweder reich an Mut, an Vertrauen oder an Verrücktheit sind. Weil Sie Verlegerin und zukünftiger Leser eines Magazins geworden sind, von dem noch nichts existiert als ein ehrgeiziger Plan.
2. Dass wir Ihnen für Ihren Mut, Ihr Vertrauen, Ihre Verrücktheit (Unzutreffendes streichen) verpflichtet sind – jedem und jeder Einzelnen von Ihnen. Wir werden hart daran arbeiten, ein Internet-Magazin zu bauen, das Sie (nicht bei jedem Artikel, aber in der Bilanz) stolz macht, das Risiko eingegangen zu sein.

Mit Dank für Ihre Kühnheit und unsere Verantwortung,

Ihre Crew der Republik und von Project&nbsp;R
            `}
            {me && !hasEnded ? [
              <P>
                PS: Falls Ihnen noch jemand einfällt, der Ihre Vorliebe für Mut, Vertrauen oder Verrücktheit teilt (Unzutreffendes – Sie wissen schon!), weisen Sie die Person auf unsere Website hin.
              </P>,
              <P>
                PPS: Zögert die Person, können Sie dieser auch ein Abonnement schenken. Denn eine Republik wird nie von wenigen gegründet, sondern von vielen: <A href='/pledge?package=ABO_GIVE'>Abonnement verschenken</A>
              </P>
            ] : !hasEnded && (
              <P>
                PS: Noch nicht Mitglied? Jetzt <A href='/pledge'>mitmachen</A> und Mitglied werden!
              </P>
            )}
            <P>
              <Share
                url={metaData.url}
                emailSubject={metaData.emailSubject}
                tweet={metaData.tweet} />
            </P>
          </NarrowContainer>
        </div>
      </div>
    )
  }
}

const DataWrapper = ({data, me}) => (
  <Loader loading={data.loading && !data.membershipStats} error={!data.membershipStats && data.error} render={() => {
    const {
      membershipStats: {
        countries,
        ages,
        createdAts
      },
      paymentStats,
      testimonialStats,
      crowdfunding: {status, hasEnded}
    } = data

    const paymentMethods = []
      .concat(paymentStats.paymentMethods)
      .sort((a, b) => descending(a.count, b.count))

    const paddedAges = range(16, 101).map(age => ({
      age,
      count: (ages.find(d => d.age === age) || {}).count || 0
    }))

    const groupedCreatedAts = nest()
      .key(({datetime}) => [
        datetime.getMonth(),
        datetime.getDate()
      ].join('-'))
      .entries(
        createdAts
          .map(({datetime, count}) => ({
            datetime: new Date(datetime),
            count
          }))
      )
    const maxCreatedAt = max(createdAts, d => d.count)
    const maxCreatedAtI2 = max(
      groupedCreatedAts.slice(2).reduce(
        (i2, {values}) => i2.concat(values),
        []
      ),
      d => d.count
    )

    const countryIndex = countries.reduce(
      (index, country) => {
        index[country.name] = country
        return index
      },
      {}
    )

    const groupedForeignCountries = nest()
      .key(d => d.count)
      .entries(
        countries
          .filter(d => d.name && d.name !== 'Schweiz')
      )
    const foreignCountries = {
      top: groupedForeignCountries[0],
      list: groupedForeignCountries
        .slice(1, groupedForeignCountries.length - 1),
      single: groupedForeignCountries[groupedForeignCountries.length - 1]
    }

    const allPostalCodes = countries.reduce(
      (all, country) => {
        if (!country.name) {
          return all
        }
        return all.concat(country.postalCodes.map(d => ({
          ...d,
          name: d.name || country.name,
          country
        })))
      },
      []
    ).sort((a, b) => descending(a.count, b.count))

    const sumCount = (sum, d) => sum + d.count
    const geoStats = {
      hasValuePercent: countries.filter(d => d.name)
        .reduce(sumCount, 0) / status.people * 100,
      zurich: countryIndex.Schweiz.postalCodes
        .filter(d => (
          d.postalCode &&
          d.postalCode.startsWith('80')
        ))
        .reduce(sumCount, 0),
      bern: countryIndex.Schweiz.postalCodes
        .filter(d => (
          d.postalCode &&
          +d.postalCode >= 3000 &&
          +d.postalCode <= 3030
        ))
        .reduce(sumCount, 0),
      basel: countryIndex.Schweiz.postalCodes
        .filter(d => (
          d.postalCode &&
          +d.postalCode >= 4000 &&
          +d.postalCode <= 4059
        ))
        .reduce(sumCount, 0),
      luzern: countryIndex.Schweiz.postalCodes
        .filter(d => (
          d.postalCode &&
          (
            +d.postalCode === 6000 ||
            +d.postalCode === 6009 ||
            +d.postalCode === 6014 ||
            +d.postalCode === 6015 ||
            (
              +d.postalCode >= 6002 &&
              +d.postalCode <= 6007
            )
          )
        ))
        .reduce(sumCount, 0),
      winterthur: countryIndex.Schweiz.postalCodes
        .filter(d => (
          d.postalCode &&
          (
            +d.postalCode === 8310 ||
            +d.postalCode === 8352 ||
            +d.postalCode === 8482 ||
            (
              +d.postalCode >= 8400 &&
              +d.postalCode <= 8411
            )
          )
        ))
        .reduce(sumCount, 0),
      aarau: countryIndex.Schweiz.postalCodes
        .filter(d => (
          d.postalCode &&
          (
            +d.postalCode === 5000 ||
            +d.postalCode === 5001
          )
        ))
        .reduce(sumCount, 0),
      baden: countryIndex.Schweiz.postalCodes
        .filter(d => (
          d.postalCode &&
          (
            +d.postalCode === 5400 ||
            +d.postalCode === 5405 ||
            +d.postalCode === 5406
          )
        ))
        .reduce(sumCount, 0),
      badenAgglo: countryIndex.Schweiz.postalCodes
        .filter(d => (
          d.postalCode &&
          (
            +d.postalCode === 5430 ||
            +d.postalCode === 5408
          )
        ))
        .reduce(sumCount, 0)
    }

    const paddedAgesIndividuals = ages.reduce(
      (all, {count, age}) => all.concat(
        range(count).map(() => age)
      ),
      []
    )

    const ageStats = {
      median: median(
        paddedAgesIndividuals
      ),
      mean: mean(
        paddedAgesIndividuals
      ),
      below16: ages.reduce(
        (sum, d) => sum + (
          d.age !== null && d.age < 16 ? d.count : 0
        ),
        0
      ),
      above100: ages.reduce(
        (sum, d) => sum + (
          d.age > 100 ? d.count : 0
        ),
        0
      ),
      noValue: ages
        .find(d => d.age === null)
        .count,
      hasValue: ages
        .filter(d => d.age !== null)
        .reduce(
          (sum, d) => sum + d.count,
          0
        )
    }

    return (
      <Story
        me={me}
        countries={countries}
        countryIndex={countryIndex}
        foreignCountries={foreignCountries}
        allPostalCodes={allPostalCodes}
        geoStats={geoStats}
        paddedAges={paddedAges}
        status={status}
        hasEnded={hasEnded}
        paymentMethods={paymentMethods}
        groupedCreatedAts={groupedCreatedAts}
        maxCreatedAt={maxCreatedAt}
        maxCreatedAtI2={maxCreatedAtI2}
        ageStats={ageStats}
        testimonialStats={testimonialStats} />
    )
  }} />
)

const membershipStats = gql`
query {
  crowdfunding(name: "${CROWDFUNDING_NAME}") {
    id
    hasEnded
    status {
      people
    }
  }
  membershipStats {
    createdAts(interval: hour) {
      datetime
      count
    }
    countries {
      name
      count
      postalCodes {
        postalCode
        name
        lat
        lon
        count
      }
    }
    ages {
      age
      count
    }
  }
  paymentStats {
    paymentMethods {
      method
      count
      details {
        detail
        count
      }
    }
  }
  testimonialStats {
    count
  }
}
`

export default compose(
  withT,
  withMe,
  graphql(membershipStats, {
    options: {
      pollInterval: +STATS_POLL_INTERVAL_MS
    }
  })
)(DataWrapper)
